import { first } from "../../core/database.js";
import { notFoundError } from "../../core/errors.js";
import { isSafeIdentifier } from "../../core/identifiers.js";

export async function serveCustomPortalPage({ env, params, head = false }) {
  if (!isSafeIdentifier(params.hotel_slug) || !isSafeIdentifier(params.page_slug)) {
    throw notFoundError("Pagina nao encontrada.");
  }
  const page = await first(
    env,
    `SELECT cp.id, cp.title, cp.sanitized_html
       FROM custom_portal_pages cp
       JOIN hotels h ON h.id = cp.hotel_id
       JOIN hotel_modules hm
         ON hm.hotel_id = cp.hotel_id
        AND hm.module_key = 'guest-portal'
      WHERE h.slug = ?
        AND h.status = 'active'
        AND h.archived_at IS NULL
        AND cp.slug = ?
        AND cp.status = 'published'
        AND cp.archived_at IS NULL
        AND hm.enabled = 1
        AND hm.is_public = 1
      LIMIT 1`,
    [params.hotel_slug, params.page_slug],
  );
  if (!page) throw notFoundError("Pagina nao encontrada.");

  const headers = customPageHeaders();
  if (head) return new Response(null, { status: 200, headers });
  return new Response(customPageShell(page), { status: 200, headers });
}

function customPageShell(page) {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title>${escapeHtml(page.title)}</title>
    <style>
      html,body{width:100%;min-height:100%;margin:0;background:#fff}
      iframe{display:block;width:100%;min-height:100vh;border:0;background:#fff}
    </style>
  </head>
  <body>
    <iframe title="${escapeAttr(page.title)}" sandbox="allow-popups allow-popups-to-escape-sandbox" referrerpolicy="no-referrer" srcdoc="${escapeAttr(page.sanitized_html)}"></iframe>
  </body>
</html>`;
}

function customPageHeaders() {
  return {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "public, max-age=60, stale-while-revalidate=300",
    "content-security-policy": [
      "default-src 'none'",
      "script-src 'none'",
      "style-src 'unsafe-inline'",
      "img-src https: data:",
      "media-src https:",
      "font-src https: data:",
      "connect-src 'none'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-src 'self'",
      "frame-ancestors 'self'",
    ].join("; "),
    "referrer-policy": "no-referrer",
    "x-robots-tag": "noindex, nofollow",
  };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}
