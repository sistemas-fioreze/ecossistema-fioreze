import { all, first } from "../../core/database.js";
import { notFoundError } from "../../core/errors.js";
import { isSafeIdentifier } from "../../core/identifiers.js";
import { collectVisualPortalMediaIds, normalizeVisualPortalDocument } from "../../services/visual-portal-document.js";

export async function serveVisualPortal({ env, params, head = false }) {
  if (!isSafeIdentifier(params.hotel_slug) || !isSafeIdentifier(params.portal_slug)) {
    throw notFoundError("Portal nao encontrado.");
  }
  const portal = await first(
    env,
    `SELECT vp.id, vp.title, vp.module_key, vp.published_document_json,
            h.id AS hotel_id, h.name AS hotel_name, h.short_name AS hotel_short_name,
            h.slug AS hotel_slug, h.locale, h.timezone,
            hb.logo_url, hb.icon_url, hb.primary_color, hb.secondary_color,
            hb.accent_color, hb.background_color, hb.text_color, hb.font_family
       FROM visual_portals vp
       JOIN hotels h ON h.id = vp.hotel_id
       JOIN hotel_modules hm
         ON hm.hotel_id = vp.hotel_id
        AND hm.module_key = vp.module_key
       LEFT JOIN hotel_branding hb ON hb.hotel_id = vp.hotel_id
      WHERE h.slug = ?
        AND h.status = 'active'
        AND h.archived_at IS NULL
        AND vp.slug = ?
        AND vp.status = 'published'
        AND vp.archived_at IS NULL
        AND vp.published_document_json IS NOT NULL
        AND hm.enabled = 1
        AND hm.is_public = 1
      LIMIT 1`,
    [params.hotel_slug, params.portal_slug],
  );
  if (!portal) throw notFoundError("Portal nao encontrado.");

  const document = normalizeVisualPortalDocument(JSON.parse(portal.published_document_json));
  const media = await loadPublishedMedia(env, portal.hotel_id, document);
  const headers = visualPortalHeaders();
  if (head) return new Response(null, { status: 200, headers });
  return new Response(renderVisualPortalPage({ portal, document, media }), { status: 200, headers });
}

async function loadPublishedMedia(env, hotelId, document) {
  const ids = collectVisualPortalMediaIds(document);
  if (!ids.length) return new Map();
  const placeholders = ids.map(() => "?").join(", ");
  const rows = await all(
    env,
    `SELECT id, public_url, alt_text, mime_type
       FROM media_assets
      WHERE hotel_id = ?
        AND status = 'active'
        AND id IN (${placeholders})`,
    [hotelId, ...ids],
  );
  return new Map(rows.filter((row) => /^\/media\/[a-z0-9_-]+$/i.test(row.public_url || "")).map((row) => [row.id, row]));
}

export function renderVisualPortalPage({ portal, document, media = new Map() }) {
  const settings = document.settings;
  const blocks = document.blocks.map((block) => renderBlock(block, media)).join("");
  const logo = safeMediaPath(portal.logo_url);
  const pageBackground = renderPageBackground(settings, media);
  return `<!doctype html>
<html lang="${escapeAttr(String(portal.locale || "pt-BR").replace("_", "-"))}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="${escapeAttr(settings.primary_color)}">
    <title>${escapeHtml(portal.title)} | ${escapeHtml(portal.hotel_short_name || portal.hotel_name)}</title>
    <style>${visualPortalCss(settings)}</style>
  </head>
  <body>
    <a class="skip-link" href="#conteudo">Ir para o conteúdo</a>
    ${pageBackground}
    <header class="site-header">
      <a class="brand" href="/${escapeAttr(portal.hotel_slug)}" aria-label="${escapeAttr(portal.hotel_name)}">
        ${logo ? `<img src="${escapeAttr(logo)}" alt="${escapeAttr(portal.hotel_name)}">` : `<strong>${escapeHtml(portal.hotel_short_name || portal.hotel_name)}</strong>`}
      </a>
    </header>
    <main id="conteudo" class="visual-page" data-module="${escapeAttr(portal.module_key)}">${blocks || '<section class="empty-page"><h1>Conteúdo em preparação</h1></section>'}</main>
  </body>
</html>`;
}

function renderBlock(block, media) {
  const classes = [
    "visual-block",
    `visual-${block.type}`,
    block.visibility.desktop ? "" : "hide-desktop",
    block.visibility.mobile ? "" : "hide-mobile",
  ].filter(Boolean).join(" ");
  const attributes = `id="${escapeAttr(block.id)}" class="${classes}" style="${escapeAttr(blockStyle(block.styles))}"`;
  const content = block.content;

  if (block.type === "hero") {
    const asset = media.get(content.media_asset_id);
    const background = asset && String(asset.mime_type).startsWith("image/") ? ` style="background-image:linear-gradient(rgba(0,0,0,${content.overlay / 100}),rgba(0,0,0,${content.overlay / 100})),url('${escapeCssUrl(asset.public_url)}')"` : "";
    return `<section ${attributes}><div class="hero-media"${background}><div class="block-inner hero-copy">${content.eyebrow ? `<p class="eyebrow">${escapeHtml(content.eyebrow)}</p>` : ""}<h1>${escapeHtml(content.title)}</h1>${paragraphs(content.text)}${buttonLink(content.button_text, content.button_url)}</div></div></section>`;
  }
  if (block.type === "heading") return `<section ${attributes}><div class="block-inner"><h2>${escapeHtml(content.title)}</h2>${paragraphs(content.text)}</div></section>`;
  if (block.type === "text") return `<section ${attributes}><div class="block-inner rich-text">${paragraphs(content.text)}</div></section>`;
  if (block.type === "button") return `<section ${attributes}><div class="block-inner">${buttonLink(content.text, content.url, content.style)}</div></section>`;
  if (block.type === "image") {
    const asset = media.get(content.media_asset_id);
    if (!asset || !String(asset.mime_type).startsWith("image/")) return "";
    return `<figure ${attributes}><div class="block-inner"><img class="media-${escapeAttr(content.fit)}" src="${escapeAttr(asset.public_url)}" alt="${escapeAttr(content.alt_text || asset.alt_text || "")}" loading="lazy">${content.caption ? `<figcaption>${escapeHtml(content.caption)}</figcaption>` : ""}</div></figure>`;
  }
  if (block.type === "video") {
    const asset = media.get(content.media_asset_id);
    const poster = media.get(content.poster_media_asset_id);
    if (!asset || !String(asset.mime_type).startsWith("video/")) return "";
    const flags = [content.controls ? "controls" : "", content.autoplay ? "autoplay" : "", content.muted ? "muted" : "", content.loop ? "loop" : ""].filter(Boolean).join(" ");
    return `<section ${attributes}><div class="block-inner">${content.title ? `<h2>${escapeHtml(content.title)}</h2>` : ""}<video ${flags} playsinline preload="metadata"${poster ? ` poster="${escapeAttr(poster.public_url)}"` : ""}><source src="${escapeAttr(asset.public_url)}" type="${escapeAttr(asset.mime_type)}"></video></div></section>`;
  }
  if (block.type === "embed") {
    if (!content.url) return "";
    const allowFullscreen = content.allow_fullscreen ? " allowfullscreen" : "";
    return `<section ${attributes}><div class="block-inner embed-frame" style="--embed-ratio:${escapeAttr(embedRatio(content.aspect_ratio))}"><iframe src="${escapeAttr(content.url)}" title="${escapeAttr(content.title || "Conteúdo incorporado")}" loading="lazy" sandbox="allow-scripts allow-forms allow-popups allow-presentation" referrerpolicy="strict-origin-when-cross-origin"${allowFullscreen}></iframe></div></section>`;
  }
  if (block.type === "gallery") {
    const assets = content.media_asset_ids.map((id) => media.get(id)).filter((asset) => asset && String(asset.mime_type).startsWith("image/"));
    return `<section ${attributes}><div class="block-inner">${content.title ? `<h2>${escapeHtml(content.title)}</h2>` : ""}<div class="gallery-grid">${assets.map((asset) => `<img src="${escapeAttr(asset.public_url)}" alt="${escapeAttr(asset.alt_text || "")}" loading="lazy">`).join("")}</div></div></section>`;
  }
  if (block.type === "feature-grid") {
    return `<section ${attributes}><div class="block-inner feature-grid">${content.items.map((item) => { const asset = media.get(item.media_asset_id); return `<article>${asset && String(asset.mime_type).startsWith("image/") ? `<img src="${escapeAttr(asset.public_url)}" alt="${escapeAttr(asset.alt_text || "")}" loading="lazy">` : ""}<div><h3>${escapeHtml(item.title)}</h3>${paragraphs(item.text)}${buttonLink(item.button_text, item.button_url, "ghost")}</div></article>`; }).join("")}</div></section>`;
  }
  if (block.type === "quote") return `<figure ${attributes}><div class="block-inner"><blockquote>${escapeHtml(content.quote)}</blockquote>${content.author ? `<figcaption>${escapeHtml(content.author)}</figcaption>` : ""}</div></figure>`;
  if (block.type === "contact") return `<section ${attributes}><div class="block-inner contact-panel"><h2>${escapeHtml(content.title)}</h2>${paragraphs(content.text)}<address>${content.address ? `<span>${escapeHtml(content.address)}</span>` : ""}${content.phone ? `<a href="tel:${escapeAttr(content.phone.replace(/[^+\d]/g, ""))}">${escapeHtml(content.phone)}</a>` : ""}${content.email ? `<a href="mailto:${escapeAttr(content.email)}">${escapeHtml(content.email)}</a>` : ""}</address>${buttonLink(content.button_text, content.button_url)}</div></section>`;
  if (block.type === "divider") return `<div ${attributes}><div class="block-inner divider"><span></span>${content.label ? `<em>${escapeHtml(content.label)}</em>` : ""}<span></span></div></div>`;
  return `<div ${attributes} aria-hidden="true"></div>`;
}

function blockStyle(styles) {
  return styleDeclarations(styles.base, "--base-") + styleDeclarations(styles.desktop, "--desktop-") + styleDeclarations(styles.mobile, "--mobile-");
}

function styleDeclarations(style, prefix) {
  const map = {
    alignment: "align",
    width: "width",
    background_color: "background",
    text_color: "text",
    accent_color: "accent",
    padding_top: "padding-top",
    padding_bottom: "padding-bottom",
    padding_inline: "padding-inline",
    gap: "gap",
    min_height: "min-height",
    border_radius: "radius",
    columns: "columns",
    heading_size: "heading-size",
    text_size: "text-size",
    offset_x: "offset-x",
    offset_y: "offset-y",
  };
  return Object.entries(map).map(([key, css]) => {
    if (style[key] == null) return "";
    if (key === "width") return `${prefix}${css}:${widthValue(style[key])};`;
    return `${prefix}${css}:${typeof style[key] === "number" && key !== "columns" ? `${style[key]}px` : style[key]};`;
  }).join("");
}

function renderPageBackground(settings, media) {
  const asset = media.get(settings.background_media_asset_id);
  if (!asset) return "";
  const style = `object-fit:${escapeAttr(settings.background_fit || "cover")};object-position:${escapeAttr(settings.background_position || "center")}`;
  const element = String(asset.mime_type).startsWith("video/")
    ? `<video muted loop autoplay playsinline preload="metadata" style="${style}"><source src="${escapeAttr(asset.public_url)}" type="${escapeAttr(asset.mime_type)}"></video>`
    : String(asset.mime_type).startsWith("image/")
      ? `<img src="${escapeAttr(asset.public_url)}" alt="" style="${style}">`
      : "";
  if (!element) return "";
  return `<div class="page-background${settings.background_fixed ? " is-fixed" : ""}" aria-hidden="true">${element}<span style="opacity:${Number(settings.background_overlay || 0) / 100}"></span></div>`;
}

function visualPortalCss(settings) {
  return `
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{position:relative;margin:0;background:${settings.background_color};color:${settings.text_color};font-family:${settings.font_family};line-height:1.6}
a{color:inherit}
.skip-link{position:fixed;left:1rem;top:-5rem;z-index:100;background:#fff;color:#111;padding:.7rem 1rem}
.skip-link:focus{top:1rem}
.page-background{position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none}
.page-background.is-fixed{position:fixed}
.page-background img,.page-background video{display:block;width:100%;height:100%}
.page-background span{position:absolute;inset:0;background:#000}
.site-header{position:absolute;inset:0 0 auto;z-index:10;display:flex;align-items:center;min-height:76px;padding:14px max(24px,env(safe-area-inset-left))}
.brand{display:inline-flex;align-items:center;text-decoration:none}
.brand img{display:block;max-width:180px;max-height:48px}
.brand strong{font-size:1.1rem}
.visual-page{position:relative;z-index:1;--page-width:${widthValue(settings.content_width)};--page-pad:${settings.page_padding}px;--block-gap:${settings.block_gap}px;display:grid;gap:var(--block-gap);min-height:100vh}
.visual-block{--align:var(--base-align,left);--width:var(--base-width,${widthValue(settings.content_width)});--background:var(--base-background,transparent);--text:var(--base-text,inherit);--accent:var(--base-accent,${settings.primary_color});--padding-top:var(--base-padding-top,0px);--padding-bottom:var(--base-padding-bottom,0px);--padding-inline:var(--base-padding-inline,var(--page-pad));--gap:var(--base-gap,20px);--min-height:var(--base-min-height,0px);--radius:var(--base-radius,0px);--columns:var(--base-columns,3);--offset-x:var(--base-offset-x,0px);--offset-y:var(--base-offset-y,0px);margin:0;background:var(--background);color:var(--text);text-align:var(--align);min-height:var(--min-height);padding:var(--padding-top) var(--padding-inline) var(--padding-bottom);border-radius:var(--radius);transform:translate(var(--offset-x),var(--offset-y))}
.block-inner{width:min(100%,var(--width));margin-inline:auto}
.visual-block h1,.visual-block h2,.visual-block h3,.visual-block p{margin-top:0;overflow-wrap:anywhere}
.visual-block h1{font-size:var(--base-heading-size,clamp(2.5rem,7vw,6.5rem));line-height:.98;letter-spacing:0;margin-bottom:1.4rem}
.visual-block h2{font-size:var(--base-heading-size,clamp(2rem,4vw,4.2rem));line-height:1.05;letter-spacing:0;margin-bottom:1rem}
.visual-block h3{font-size:var(--base-heading-size,1.25rem);line-height:1.2}
.visual-block p{max-width:760px;margin-inline:auto;font-size:var(--base-text-size,inherit)}
.eyebrow{font-size:.78rem;font-weight:800;text-transform:uppercase;letter-spacing:.12em}
.visual-button{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:.75rem 1.25rem;border:1px solid var(--accent);border-radius:999px;background:var(--accent);color:#fff;text-decoration:none;font-weight:750}
.visual-button.is-outline{background:transparent;color:var(--accent)}
.visual-button.is-ghost{min-height:auto;padding:.25rem 0;border:0;border-bottom:1px solid currentColor;border-radius:0;background:transparent;color:var(--accent)}
.hero-media{display:grid;place-items:center;min-height:inherit;margin:calc(var(--padding-top) * -1) calc(var(--padding-inline) * -1) calc(var(--padding-bottom) * -1);padding:var(--padding-top) var(--padding-inline) var(--padding-bottom);border-radius:inherit;background-position:center;background-size:cover}
.hero-copy{position:relative}
.visual-hero:has(.hero-media[style]){color:#fff}
.visual-image img,.visual-video video{display:block;width:100%;max-height:78vh;border-radius:var(--radius);background:#111}
.visual-image .media-cover{aspect-ratio:16/9;object-fit:cover}
.visual-image .media-contain{object-fit:contain}
.visual-image figcaption{margin-top:.65rem;color:color-mix(in srgb,currentColor 68%,transparent);font-size:.9rem}
.embed-frame{aspect-ratio:var(--embed-ratio);overflow:hidden;border-radius:var(--radius);background:#e8e9ec}
.embed-frame iframe{display:block;width:100%;height:100%;border:0}
.gallery-grid,.feature-grid{display:grid;grid-template-columns:repeat(var(--columns),minmax(0,1fr));gap:var(--gap)}
.gallery-grid img{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:var(--radius)}
.feature-grid article{overflow:hidden;background:color-mix(in srgb,var(--background) 82%,#fff);border:1px solid color-mix(in srgb,currentColor 14%,transparent);border-radius:var(--radius,20px);text-align:left}
.feature-grid article img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover}
.feature-grid article>div{padding:1.25rem}
.visual-quote blockquote{max-width:950px;margin:0 auto;font-size:var(--base-heading-size,clamp(1.6rem,3.2vw,3.3rem));line-height:1.2;font-weight:650}
.visual-quote figcaption{margin-top:1.25rem}
.contact-panel address{display:grid;gap:.35rem;font-style:normal}
.divider{display:flex;align-items:center;gap:1rem}
.divider span{height:1px;flex:1;background:currentColor;opacity:.22}
.divider em{font-style:normal;font-size:.85rem}
.visual-spacer{min-height:var(--min-height,48px)}
.hide-desktop{display:none}
@media (min-width:761px){
  .visual-block{--align:var(--desktop-align,var(--base-align,left));--width:var(--desktop-width,var(--base-width,${widthValue(settings.content_width)}));--background:var(--desktop-background,var(--base-background,transparent));--text:var(--desktop-text,var(--base-text,inherit));--accent:var(--desktop-accent,var(--base-accent,${settings.primary_color}));--padding-top:var(--desktop-padding-top,var(--base-padding-top,0px));--padding-bottom:var(--desktop-padding-bottom,var(--base-padding-bottom,0px));--padding-inline:var(--desktop-padding-inline,var(--base-padding-inline,var(--page-pad)));--gap:var(--desktop-gap,var(--base-gap,20px));--min-height:var(--desktop-min-height,var(--base-min-height,0px));--radius:var(--desktop-radius,var(--base-radius,0px));--columns:var(--desktop-columns,var(--base-columns,3));--offset-x:var(--desktop-offset-x,var(--base-offset-x,0px));--offset-y:var(--desktop-offset-y,var(--base-offset-y,0px))}
  .visual-block h1{font-size:var(--desktop-heading-size,var(--base-heading-size,clamp(2.5rem,7vw,6.5rem)))}
  .visual-block h2{font-size:var(--desktop-heading-size,var(--base-heading-size,clamp(2rem,4vw,4.2rem)))}
  .visual-block h3{font-size:var(--desktop-heading-size,var(--base-heading-size,1.25rem))}
  .visual-block p{font-size:var(--desktop-text-size,var(--base-text-size,inherit))}
  .visual-quote blockquote{font-size:var(--desktop-heading-size,var(--base-heading-size,clamp(1.6rem,3.2vw,3.3rem)))}
}
@media (max-width:760px){
  .site-header{min-height:64px;padding-inline:max(18px,env(safe-area-inset-left))}
  .brand img{max-width:142px;max-height:38px}
  .visual-block{--align:var(--mobile-align,var(--base-align,left));--width:var(--mobile-width,var(--base-width,${widthValue(settings.content_width)}));--background:var(--mobile-background,var(--base-background,transparent));--text:var(--mobile-text,var(--base-text,inherit));--accent:var(--mobile-accent,var(--base-accent,${settings.primary_color}));--padding-top:var(--mobile-padding-top,var(--base-padding-top,0px));--padding-bottom:var(--mobile-padding-bottom,var(--base-padding-bottom,0px));--padding-inline:var(--mobile-padding-inline,var(--base-padding-inline,18px));--gap:var(--mobile-gap,var(--base-gap,16px));--min-height:var(--mobile-min-height,var(--base-min-height,0px));--radius:var(--mobile-radius,var(--base-radius,0px));--columns:var(--mobile-columns,1);--offset-x:var(--mobile-offset-x,var(--base-offset-x,0px));--offset-y:var(--mobile-offset-y,var(--base-offset-y,0px))}
  .hide-desktop{display:initial}.hide-mobile{display:none}
  .feature-grid,.gallery-grid{grid-template-columns:repeat(var(--columns),minmax(0,1fr))}
  .visual-button{width:100%}
  .visual-block h1{font-size:var(--mobile-heading-size,var(--base-heading-size,clamp(2.45rem,13vw,4.4rem)))}
  .visual-block h2{font-size:var(--mobile-heading-size,var(--base-heading-size,clamp(2rem,10vw,3rem)))}
  .visual-block h3{font-size:var(--mobile-heading-size,var(--base-heading-size,1.25rem))}
  .visual-block p{font-size:var(--mobile-text-size,var(--base-text-size,inherit))}
  .visual-quote blockquote{font-size:var(--mobile-heading-size,var(--base-heading-size,clamp(1.6rem,8vw,2.4rem)))}
}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
`;
}

function paragraphs(value) {
  return String(value || "").split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean).map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`).join("");
}

function buttonLink(text, url, style = "solid") {
  if (!text || !url) return "";
  const external = /^https:\/\//i.test(url);
  return `<a class="visual-button is-${escapeAttr(style || "solid")}" href="${escapeAttr(url)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${escapeHtml(text)}</a>`;
}

function widthValue(width) {
  return ({ narrow: "720px", content: "1120px", wide: "1440px", full: "100%" })[width] || "1120px";
}

function embedRatio(value) {
  return ({ "16:9": "16 / 9", "4:3": "4 / 3", "1:1": "1", "9:16": "9 / 16" })[value] || "16 / 9";
}

function alignmentMargin() {
  return "auto";
}

function safeMediaPath(value) {
  return /^\/(?:media|assets)\/[a-z0-9_./-]+$/i.test(value || "") ? value : "";
}

function escapeCssUrl(value) {
  return String(value).replace(/["'()\\\n\r]/g, "");
}

function visualPortalHeaders() {
  return {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "public, max-age=60, stale-while-revalidate=300",
    "content-security-policy": [
      "default-src 'none'",
      "script-src 'none'",
      "style-src 'unsafe-inline'",
      "img-src 'self' data:",
      "media-src 'self'",
      "frame-src https:",
      "font-src 'self' data:",
      "connect-src 'none'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'self'",
    ].join("; "),
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-content-type-options": "nosniff",
  };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}
