import { apiGet } from "../core/api.js";

const BLOG_HOST = "blog.hoteisfioreze.com.br";
const mount = typeof document === "undefined" ? null : document.querySelector("[data-visual-blog]");

if (mount) bootBlogPage(mount);

export async function bootBlogPage(container, { api = apiGet } = {}) {
  const hotelSlug = String(container.dataset.hotelSlug || "").trim().toLowerCase();
  try {
    const payload = await api(`/api/v1/public/hotels/${encodeURIComponent(hotelSlug)}/portal/blog`);
    renderBlog(container, payload);
  } catch {
    renderUnavailable(container);
  }
}

export function renderBlog(container, payload = {}) {
  const posts = Array.isArray(payload.posts) ? payload.posts.filter(validPost) : [];
  container.querySelector(".visual-blog-loading")?.remove();
  container.querySelector(".visual-blog-state")?.remove();
  container.querySelector(".visual-blog-grid")?.remove();

  if (payload.available === false) {
    container.append(createState("Blog indisponível no momento.", "Tente novamente em instantes."));
    return;
  }
  if (!posts.length) {
    container.append(createState("Nenhuma publicação disponível.", "Novos conteúdos aparecerão aqui."));
    return;
  }

  const grid = document.createElement("div");
  grid.className = "visual-blog-grid";
  posts.forEach((post, index) => grid.append(createPostCard(post, index === 0)));
  container.append(grid);
}

function createPostCard(post, featured) {
  const card = document.createElement("a");
  card.className = `visual-blog-card${featured ? " is-featured" : ""}`;
  card.href = safeBlogUrl(post.link);
  card.target = "_blank";
  card.rel = "noopener noreferrer";

  const media = document.createElement("div");
  media.className = "visual-blog-media";
  const imageUrl = safeImageUrl(post.image_url);
  if (imageUrl) {
    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = "";
    image.loading = featured ? "eager" : "lazy";
    image.decoding = "async";
    media.append(image);
  } else {
    media.innerHTML = blogIcon();
  }

  const copy = document.createElement("div");
  copy.className = "visual-blog-copy";
  const meta = document.createElement("small");
  meta.className = "visual-blog-pill";
  meta.textContent = featured ? "Blog Fioreze" : formatDate(post.published_at);
  const title = document.createElement("h2");
  title.textContent = String(post.title || "Publicação");
  copy.append(meta, title);
  if (post.excerpt) {
    const excerpt = document.createElement("p");
    excerpt.textContent = String(post.excerpt);
    copy.append(excerpt);
  }
  const footer = document.createElement("footer");
  const date = document.createElement("span");
  date.textContent = featured ? formatDate(post.published_at) : "";
  const action = document.createElement("strong");
  action.textContent = "Ler artigo";
  footer.append(date, action);
  copy.append(footer);
  card.append(media, copy);
  return card;
}

function createState(titleText, detailText) {
  const state = document.createElement("section");
  state.className = "visual-blog-state";
  state.innerHTML = blogIcon();
  const title = document.createElement("h2");
  title.textContent = titleText;
  const detail = document.createElement("p");
  detail.textContent = detailText;
  state.append(title, detail);
  return state;
}

function renderUnavailable(container) {
  container.querySelector(".visual-blog-loading")?.remove();
  container.append(createState("Blog indisponível no momento.", "Não foi possível carregar as publicações."));
}

function validPost(post) {
  return Boolean(post && String(post.title || "").trim() && safeBlogUrl(post.link));
}

function safeBlogUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && url.hostname === BLOG_HOST ? url.toString() : "";
  } catch {
    return "";
  }
}

function safeImageUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function formatDate(value) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return "Conteúdo recente";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function blogIcon() {
  return '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Z"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>';
}
