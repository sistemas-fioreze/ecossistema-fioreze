const DEFAULT_BLOG_FEED = "https://blog.hoteisfioreze.com.br/wp-json/wp/v2/posts";
const BLOG_HOST = "blog.hoteisfioreze.com.br";
const EXTERNAL_TIMEOUT_MS = 8000;

export async function loadPublicBlog({ feedUrl, fetchImpl = fetch }) {
  const url = buildBlogUrl(feedUrl);
  const response = await fetchWithTimeout(fetchImpl, url);
  if (!response.ok) throw new Error("Blog temporariamente indisponivel.");
  const payload = await response.json();
  if (!Array.isArray(payload)) throw new Error("Resposta do blog invalida.");
  return payload.slice(0, 12).map(formatBlogPost).filter(Boolean);
}

export function buildBlogUrl(value) {
  const candidate = String(value || DEFAULT_BLOG_FEED).trim();
  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("Feed do blog invalido.");
  }
  if (url.protocol !== "https:" || url.hostname !== BLOG_HOST || normalizedPath(url.pathname) !== "/wp-json/wp/v2/posts") {
    throw new Error("Feed do blog nao autorizado.");
  }
  url.search = "";
  url.searchParams.set("per_page", "12");
  url.searchParams.set("_embed", "wp:featuredmedia");
  url.searchParams.set("_fields", "id,date,modified,slug,link,title,excerpt,yoast_head_json,_embedded");
  return url.toString();
}

function formatBlogPost(post) {
  const id = String(post?.id || "").trim();
  const title = stripHtml(post?.title?.rendered || post?.title);
  const link = safeBlogUrl(post?.link);
  if (!id || !title || !link) return null;
  const media = post?._embedded?.["wp:featuredmedia"]?.[0];
  return {
    id,
    slug: safeText(post?.slug, 160),
    title,
    excerpt: stripHtml(post?.excerpt?.rendered || post?.yoast_head_json?.og_description).slice(0, 600),
    published_at: validIsoDate(post?.date || post?.modified),
    link,
    image_url: safeHttpsUrl(
      media?.media_details?.sizes?.large?.source_url ||
        media?.media_details?.sizes?.medium_large?.source_url ||
        media?.source_url ||
        post?.yoast_head_json?.og_image?.[0]?.url,
    ),
  };
}

function fetchWithTimeout(fetchImpl, url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EXTERNAL_TIMEOUT_MS);
  return Promise.resolve()
    .then(() => fetchImpl(url, { headers: { Accept: "application/json" }, signal: controller.signal }))
    .finally(() => clearTimeout(timer));
}

function normalizedPath(value) {
  return String(value || "/").replace(/\/+$/, "") || "/";
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:0*39|x0*27);/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(x?[0-9a-f]+);/gi, (_, rawCode) => decodeNumericEntity(rawCode))
    .replace(/\s+/g, " ")
    .trim();
}

function decodeNumericEntity(rawCode) {
  const hexadecimal = String(rawCode).toLowerCase().startsWith("x");
  const codePoint = Number.parseInt(hexadecimal ? String(rawCode).slice(1) : rawCode, hexadecimal ? 16 : 10);
  if (!Number.isInteger(codePoint) || codePoint < 32 || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) return "";
  return String.fromCodePoint(codePoint);
}

function safeBlogUrl(value) {
  const url = safeHttpsUrl(value);
  if (!url) return null;
  return new URL(url).hostname === BLOG_HOST ? url : null;
}

function safeHttpsUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function validIsoDate(value) {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function safeText(value, max) {
  return String(value || "").trim().slice(0, max);
}
