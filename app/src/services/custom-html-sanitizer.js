import xss from "xss";
import { badRequest } from "../core/errors.js";

export const CUSTOM_HTML_MAX_LENGTH = 250000;
export const CUSTOM_HTML_SANITIZER_VERSION = "fioreze-html-v1";

const allowedTags = [
  "html",
  "head",
  "title",
  "body",
  "main",
  "header",
  "footer",
  "nav",
  "section",
  "article",
  "aside",
  "div",
  "span",
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "small",
  "mark",
  "blockquote",
  "pre",
  "code",
  "br",
  "hr",
  "figure",
  "figcaption",
  "picture",
  "img",
  "video",
  "audio",
  "source",
  "a",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
];

const globalAttributes = ["class", "id", "style", "title", "dir", "lang", "role"];
const tagAttributes = {
  a: ["href", "target", "rel"],
  img: ["src", "alt", "width", "height", "loading"],
  video: ["src", "poster", "controls", "muted", "loop", "autoplay", "playsinline", "width", "height"],
  audio: ["src", "controls", "muted", "loop", "autoplay"],
  source: ["src", "type", "media"],
  th: ["colspan", "rowspan", "scope"],
  td: ["colspan", "rowspan"],
};
const whiteList = Object.fromEntries(allowedTags.map((tag) => [tag, [...globalAttributes, ...(tagAttributes[tag] || [])]]));
const cssWhiteList = {
  color: true,
  "background-color": true,
  "font-family": true,
  "font-size": true,
  "font-weight": /^(?:normal|bold|[1-9]00)$/,
  "font-style": /^(?:normal|italic|oblique)$/,
  "line-height": true,
  "text-align": /^(?:left|right|center|justify|start|end)$/,
  "text-decoration": true,
  display: /^(?:block|inline|inline-block|flex|grid|none)$/,
  "flex-direction": /^(?:row|column|row-reverse|column-reverse)$/,
  "align-items": true,
  "justify-content": true,
  gap: true,
  width: true,
  "max-width": true,
  height: true,
  "min-height": true,
  margin: true,
  padding: true,
  border: true,
  "border-radius": true,
  overflow: /^(?:visible|hidden|auto|scroll)$/,
  "object-fit": /^(?:fill|contain|cover|none|scale-down)$/,
};

export function sanitizeCustomHtml(value) {
  if (typeof value !== "string") throw badRequest("html deve ser texto.");
  const input = value.trim();
  if (!input) throw badRequest("html e obrigatorio.");
  if (input.length > CUSTOM_HTML_MAX_LENGTH) throw badRequest("html excede o tamanho permitido.");

  const sanitizer = new xss.FilterXSS({
    whiteList,
    stripIgnoreTag: true,
    stripIgnoreTagBody: ["script", "iframe", "object", "embed", "form", "input", "button", "textarea", "select", "option", "link", "meta", "base"],
    css: { whiteList: cssWhiteList },
    safeAttrValue: safeAttributeValue,
    onIgnoreTagAttr(tag, name, attributeValue) {
      if (/^aria-[a-z0-9-]+$/i.test(name)) {
        return `${name}="${xss.escapeAttrValue(attributeValue)}"`;
      }
      return undefined;
    },
  });
  const sanitized = sanitizer.process(input).trim();

  if (!sanitized) throw badRequest("html nao possui conteudo permitido.");
  return {
    html: sanitized,
    changed: sanitized !== input,
    sanitizer_version: CUSTOM_HTML_SANITIZER_VERSION,
  };
}

function safeAttributeValue(tag, name, value, cssFilter) {
  if (["href", "src", "poster"].includes(name)) {
    const normalized = String(value).trim();
    if (normalized.startsWith("//")) return "";
    if (name === "href" && !/^(?:https?:|mailto:|tel:|\/|#)/i.test(normalized)) return "";
    if (name === "src" && tag === "img" && !/^(?:https:|data:image\/)/i.test(normalized)) return "";
    if ((name === "src" || name === "poster") && tag !== "img" && !/^https:/i.test(normalized)) return "";
  }
  return xss.safeAttrValue(tag, name, value, cssFilter);
}

export async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
