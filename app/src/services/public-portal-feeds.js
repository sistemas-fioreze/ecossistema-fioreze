const DEFAULT_BLOG_FEED = "https://blog.hoteisfioreze.com.br/wp-json/wp/v2/posts";
const BLOG_HOST = "blog.hoteisfioreze.com.br";
const EXTERNAL_TIMEOUT_MS = 8000;

export const DEFAULT_WEATHER_LOCATION = Object.freeze({
  name: "Gramado",
  latitude: -29.3788,
  longitude: -50.8738,
  timezone: "America/Sao_Paulo",
});

export async function loadPublicBlog({ feedUrl, fetchImpl = fetch }) {
  const url = buildBlogUrl(feedUrl);
  const response = await fetchWithTimeout(fetchImpl, url);
  if (!response.ok) throw new Error("Blog temporariamente indisponivel.");
  const payload = await response.json();
  if (!Array.isArray(payload)) throw new Error("Resposta do blog invalida.");
  return payload.slice(0, 12).map(formatBlogPost).filter(Boolean);
}

export async function loadPublicWeather({ latitude, longitude, timezone, fetchImpl = fetch }) {
  const lat = finiteCoordinate(latitude, 90);
  const lon = finiteCoordinate(longitude, 180);
  if (lat === null || lon === null) return { available: false, current: null, forecast: [] };

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("current", "temperature_2m,apparent_temperature,weather_code,precipitation,rain,relative_humidity_2m");
  url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max");
  url.searchParams.set("timezone", safeTimezone(timezone));
  url.searchParams.set("forecast_days", "3");

  const response = await fetchWithTimeout(fetchImpl, url);
  if (!response.ok) throw new Error("Previsao do tempo temporariamente indisponivel.");
  const payload = await response.json();
  const current = payload?.current || {};
  const daily = payload?.daily || {};
  const temperature = finiteNumber(current.temperature_2m);
  if (temperature === null) throw new Error("Previsao do tempo invalida.");

  const currentCode = integerNumber(current.weather_code ?? daily.weather_code?.[0], 2);
  return {
    available: true,
    current: {
      temperature: Math.round(temperature),
      apparent_temperature: roundedNumber(current.apparent_temperature),
      weather_code: currentCode,
      description: weatherDescription(currentCode),
      precipitation: finiteNumber(current.precipitation) ?? 0,
      humidity: roundedNumber(current.relative_humidity_2m),
      updated_at: safeText(current.time, 40),
    },
    forecast: (Array.isArray(daily.time) ? daily.time : []).slice(0, 3).map((date, index) => {
      const code = integerNumber(daily.weather_code?.[index], currentCode);
      return {
        date: safeText(date, 20),
        weather_code: code,
        description: weatherDescription(code),
        temperature_max: roundedNumber(daily.temperature_2m_max?.[index]),
        temperature_min: roundedNumber(daily.temperature_2m_min?.[index]),
        precipitation_probability: roundedNumber(daily.precipitation_probability_max?.[index]) ?? 0,
      };
    }),
  };
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

function finiteCoordinate(value, max) {
  const number = finiteNumber(value);
  return number !== null && number >= -max && number <= max ? number : null;
}

function finiteNumber(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}

function roundedNumber(value) {
  const number = finiteNumber(value);
  return number === null ? null : Math.round(number);
}

function integerNumber(value, fallback) {
  const number = Number.parseInt(String(value ?? fallback), 10);
  return Number.isInteger(number) ? number : fallback;
}

function validIsoDate(value) {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function safeText(value, max) {
  return String(value || "").trim().slice(0, max);
}

function safeTimezone(value) {
  const timezone = String(value || "America/Sao_Paulo");
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: timezone }).format();
    return timezone;
  } catch {
    return "America/Sao_Paulo";
  }
}

function weatherDescription(code) {
  if (code === 0) return "Céu limpo";
  if ([1, 2].includes(code)) return "Parcialmente nublado";
  if (code === 3) return "Nublado";
  if ([45, 48].includes(code)) return "Neblina";
  if ([51, 53, 55, 56, 57].includes(code)) return "Garoa";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Chuva";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Neve";
  if ([95, 96, 99].includes(code)) return "Trovoadas";
  return "Tempo variável";
}
