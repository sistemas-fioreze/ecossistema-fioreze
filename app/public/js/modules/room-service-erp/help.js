import { HELP_ARTICLES, HELP_CATEGORIES, HELP_ROUTE_LABELS } from "./help-content.js?v=20260820-4";
import { iconMarkup } from "./icon-system.js";

export function normalizeHelpSearch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();
}

export function articleSearchText(article, categories = HELP_CATEGORIES) {
  const category = categories.find((item) => item.id === article.category)?.label || article.category;
  return normalizeHelpSearch([
    article.title,
    article.description,
    category,
    ...(article.keywords || []),
    ...(article.steps || []).flatMap((step) => [step.title, step.text]),
  ].join(" "));
}

export function canAccessHelpArticle(article, { permissions = [], isElectron = false, isMaster = false } = {}) {
  const platforms = article.platforms || ["web", "electron"];
  if (!platforms.includes(isElectron ? "electron" : "web")) return false;
  if (isMaster || !(article.permissions || []).length) return true;
  const allowed = new Set(permissions);
  return article.permissions.every((permission) => allowed.has(permission));
}

export function searchHelpArticles(articles, query, categories = HELP_CATEGORIES) {
  const terms = normalizeHelpSearch(query).split(" ").filter(Boolean);
  if (!terms.length) return [];
  return articles
    .map((article) => {
      const haystack = articleSearchText(article, categories);
      const title = normalizeHelpSearch(article.title);
      const keywordText = normalizeHelpSearch((article.keywords || []).join(" "));
      if (!terms.every((term) => haystack.includes(term))) return null;
      const score = terms.reduce((total, term) => total + (title.includes(term) ? 8 : 0) + (keywordText.includes(term) ? 4 : 0), 0);
      return { article, score };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score || left.article.title.localeCompare(right.article.title, "pt-BR"))
    .map(({ article }) => article);
}

export function setupHelpCenter({ getRoute, getPermissions, isElectron, isMaster } = {}) {
  const sessionButton = document.querySelector(".top-session");
  if (!sessionButton || document.getElementById("erpHelpButton")) return createNoopController();

  const helpButton = document.createElement("button");
  helpButton.id = "erpHelpButton";
  helpButton.type = "button";
  helpButton.className = "top-action erp-help-trigger";
  helpButton.title = "Ajuda";
  helpButton.setAttribute("aria-label", "Ajuda");
  helpButton.setAttribute("aria-haspopup", "dialog");
  helpButton.setAttribute("aria-expanded", "false");
  helpButton.innerHTML = iconMarkup("circle-help");
  sessionButton.before(helpButton);

  const root = document.createElement("div");
  root.id = "erpHelpCenter";
  root.className = "erp-help-overlay hidden";
  root.innerHTML = helpShell();
  document.body.append(root);

  const state = { view: { type: "home" }, back: [], forward: [], lastFocus: null };
  const dialog = root.querySelector(".erp-help-dialog");
  const content = root.querySelector("#erpHelpContent");
  const search = root.querySelector("#erpHelpSearch");
  const lightbox = root.querySelector("#erpHelpLightbox");

  helpButton.addEventListener("click", open);
  root.addEventListener("click", handleClick);
  search.addEventListener("input", () => {
    const query = search.value.trim();
    if (!query && state.view.type === "search") navigate({ type: "home" }, { record: false });
    else if (query) navigate({ type: "search", query }, { record: false });
  });
  root.addEventListener("keydown", handleKeydown);

  return { open, close, closeIfOpen, refresh: render };

  function availableArticles() {
    return HELP_ARTICLES.filter((article) => canAccessHelpArticle(article, {
      permissions: getPermissions?.() || [],
      isElectron: Boolean(isElectron?.()),
      isMaster: Boolean(isMaster?.()),
    }));
  }

  function open() {
    state.lastFocus = document.activeElement;
    root.classList.remove("hidden");
    document.body.classList.add("erp-help-open");
    helpButton.setAttribute("aria-expanded", "true");
    state.view = { type: "home" };
    state.back = [];
    state.forward = [];
    search.value = "";
    render();
    requestAnimationFrame(() => search.focus());
  }

  function close() {
    if (root.classList.contains("hidden")) return;
    closeLightbox();
    root.classList.add("hidden");
    document.body.classList.remove("erp-help-open");
    helpButton.setAttribute("aria-expanded", "false");
    (state.lastFocus instanceof HTMLElement ? state.lastFocus : helpButton).focus();
  }

  function closeIfOpen() {
    if (!lightbox.classList.contains("hidden")) {
      closeLightbox();
      return true;
    }
    if (root.classList.contains("hidden")) return false;
    close();
    return true;
  }

  function handleClick(event) {
    if (event.target === root || event.target.closest("[data-help-close]")) return close();
    if (event.target === lightbox || event.target.closest("[data-help-lightbox-close]")) return closeLightbox();
    const image = event.target.closest("[data-help-image]");
    if (image) return openLightbox(image.dataset.helpImage, image.dataset.helpAlt || "Captura do ERP");
    const action = event.target.closest("[data-help-action]")?.dataset.helpAction;
    if (action === "home") return navigate({ type: "home" });
    if (action === "back") return goBack();
    if (action === "forward") return goForward();
    if (action === "context") return navigate({ type: "context", route: activeRoute() });
    const category = event.target.closest("[data-help-category]")?.dataset.helpCategory;
    if (category) return navigate({ type: "category", id: category });
    const article = event.target.closest("[data-help-article]")?.dataset.helpArticle;
    if (article) return navigate({ type: "article", id: article });
  }

  function handleKeydown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase("pt-BR") === "k") {
      event.preventDefault();
      event.stopPropagation();
      search.focus();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeIfOpen();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')]
      .filter((element) => !element.closest(".hidden"));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function navigate(view, { record = true } = {}) {
    if (record && !sameView(view, state.view)) {
      state.back.push(state.view);
      state.forward = [];
    }
    state.view = view;
    render();
  }

  function goBack() {
    const previous = state.back.pop();
    if (!previous) return;
    state.forward.push(state.view);
    state.view = previous;
    render();
  }

  function goForward() {
    const next = state.forward.pop();
    if (!next) return;
    state.back.push(state.view);
    state.view = next;
    render();
  }

  function render() {
    const articles = availableArticles();
    renderNavigation(articles);
    root.querySelector('[data-help-action="back"]').disabled = !state.back.length;
    root.querySelector('[data-help-action="forward"]').disabled = !state.forward.length;
    root.querySelector("#erpHelpContextLabel").textContent = HELP_ROUTE_LABELS[activeRoute()] || "Esta tela";
    if (state.view.type === "article") renderArticle(articles.find((article) => article.id === state.view.id), articles);
    else if (state.view.type === "category") renderCategory(state.view.id, articles);
    else if (state.view.type === "context") renderContext(state.view.route, articles);
    else if (state.view.type === "search") renderSearch(state.view.query, articles);
    else renderHome(articles);
    content.scrollTop = 0;
  }

  function renderNavigation(articles) {
    root.querySelector("#erpHelpCategories").innerHTML = HELP_CATEGORIES.map((category) => {
      const count = articles.filter((article) => article.category === category.id).length;
      if (!count) return "";
      const active = state.view.type === "category" && state.view.id === category.id;
      return `<button type="button" class="erp-help-category${active ? " active" : ""}" data-help-category="${escapeAttr(category.id)}"${active ? ' aria-current="page"' : ""}>${iconMarkup(category.icon)}<span>${escapeHtml(category.label)}</span><small>${count}</small></button>`;
    }).join("");
  }

  function renderHome(articles) {
    const route = activeRoute();
    const contextual = articles.filter((article) => article.relatedRoutes.includes(route)).slice(0, 4);
    const popular = articles.filter((article) => article.popular).slice(0, 6);
    content.innerHTML = `<div class="erp-help-home">
      <section class="erp-help-hero"><p>Central de Ajuda</p><h2>Como podemos ajudar?</h2><span>Encontre instruções objetivas para usar o ERP com segurança.</span></section>
      ${contextual.length ? `<section class="erp-help-section"><div class="erp-help-section-head"><div><p>Contexto atual</p><h3>Ajuda sobre ${escapeHtml(HELP_ROUTE_LABELS[route] || "esta tela")}</h3></div><button type="button" class="erp-help-text-action" data-help-action="context">Ver todos ${iconMarkup("arrow-right")}</button></div><div class="erp-help-card-grid">${contextual.map(articleCard).join("")}</div></section>` : ""}
      <section class="erp-help-section"><div class="erp-help-section-head"><div><p>Atalhos úteis</p><h3>Guias populares</h3></div></div><div class="erp-help-card-grid">${popular.map(articleCard).join("")}</div></section>
    </div>`;
  }

  function renderCategory(categoryId, articles) {
    const category = HELP_CATEGORIES.find((item) => item.id === categoryId);
    const matches = articles.filter((article) => article.category === categoryId);
    content.innerHTML = listPage(category?.label || "Categoria", `${matches.length} guia${matches.length === 1 ? "" : "s"}`, matches);
  }

  function renderContext(route, articles) {
    const matches = articles.filter((article) => article.relatedRoutes.includes(route));
    content.innerHTML = listPage(`Ajuda sobre ${HELP_ROUTE_LABELS[route] || "esta tela"}`, "Guias relacionados à área em que você está trabalhando.", matches);
  }

  function renderSearch(query, articles) {
    const matches = searchHelpArticles(articles, query);
    content.innerHTML = listPage(`Resultados para “${escapeHtml(query)}”`, `${matches.length} resultado${matches.length === 1 ? "" : "s"}`, matches, "Nenhum guia corresponde a esta busca. Tente usar menos palavras ou o nome de uma área do ERP.");
  }

  function renderArticle(article, articles) {
    if (!article) {
      content.innerHTML = emptyState("Guia indisponível", "Este conteúdo não está disponível para sua conta ou plataforma.");
      return;
    }
    const category = HELP_CATEGORIES.find((item) => item.id === article.category);
    const related = (article.related || []).map((id) => articles.find((item) => item.id === id)).filter(Boolean).slice(0, 4);
    content.innerHTML = `<article class="erp-help-article">
      <header><button type="button" class="erp-help-breadcrumb" data-help-category="${escapeAttr(article.category)}">${escapeHtml(category?.label || article.category)}</button><h2>${escapeHtml(article.title)}</h2><p>${escapeHtml(article.description)}</p></header>
      <ol class="erp-help-steps">${article.steps.map((item, index) => renderStep(item, index)).join("")}</ol>
      ${related.length ? `<footer class="erp-help-related"><p>Você também pode precisar</p><div class="erp-help-related-list">${related.map(articleListItem).join("")}</div></footer>` : ""}
    </article>`;
  }

  function renderStep(item, index) {
    return `<li class="erp-help-step"><span class="erp-help-step-number">${index + 1}</span><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p>${item.screenshot ? screenshot(item) : ""}</div></li>`;
  }

  function screenshot(item) {
    const highlight = item.highlight
      ? `<span class="erp-help-highlight" style="left:${number(item.highlight.x)}%;top:${number(item.highlight.y)}%;width:${number(item.highlight.width)}%;height:${number(item.highlight.height)}%"><small>${escapeHtml(item.highlight.label || "")}</small></span>`
      : "";
    return `<figure class="erp-help-shot"><button type="button" data-help-image="${escapeAttr(item.screenshot)}" data-help-alt="${escapeAttr(item.alt)}" aria-label="Ampliar captura: ${escapeAttr(item.alt)}"><span class="erp-help-shot-frame"><img src="${escapeAttr(item.screenshot)}" alt="${escapeAttr(item.alt)}" loading="lazy" decoding="async" width="1280" height="720">${highlight}</span><span class="erp-help-shot-caption">${iconMarkup("zoom-in")} Ampliar captura</span></button></figure>`;
  }

  function openLightbox(src, alt) {
    lightbox.querySelector("img").src = src;
    lightbox.querySelector("img").alt = alt;
    lightbox.classList.remove("hidden");
    lightbox.querySelector("button").focus();
  }

  function closeLightbox() {
    lightbox.classList.add("hidden");
    lightbox.querySelector("img").removeAttribute("src");
  }

  function activeRoute() {
    return getRoute?.() || document.body.dataset.erpRoute || "dashboard";
  }
}

function helpShell() {
  return `<section class="erp-help-dialog" role="dialog" aria-modal="true" aria-labelledby="erpHelpTitle">
    <header class="erp-help-toolbar">
      <div class="erp-help-history" aria-label="Navegação da ajuda"><button type="button" data-help-action="back" aria-label="Voltar" title="Voltar">${iconMarkup("arrow-left")}</button><button type="button" data-help-action="forward" aria-label="Avançar" title="Avançar">${iconMarkup("arrow-right")}</button><button type="button" data-help-action="home" aria-label="Início da ajuda" title="Início da ajuda">${iconMarkup("house")}</button></div>
      <div class="erp-help-title"><span>${iconMarkup("circle-help")}</span><div><small>ERP Fioreze</small><strong id="erpHelpTitle">Central de Ajuda</strong></div></div>
      <label class="erp-help-search">${iconMarkup("search")}<input id="erpHelpSearch" type="search" placeholder="Pesquisar na ajuda..." autocomplete="off" aria-label="Pesquisar na ajuda"><kbd>Ctrl K</kbd></label>
      <button type="button" class="erp-help-context" data-help-action="context">${iconMarkup("scan-search")}<span>Ajuda desta tela</span><small id="erpHelpContextLabel"></small></button>
      <button type="button" class="erp-help-close" data-help-close aria-label="Fechar Central de Ajuda" title="Fechar">${iconMarkup("x")}</button>
    </header>
    <div class="erp-help-layout"><nav class="erp-help-sidebar" aria-label="Categorias da ajuda"><p>Categorias</p><div id="erpHelpCategories"></div></nav><main id="erpHelpContent" class="erp-help-content" tabindex="-1"></main></div>
  </section>
  <div id="erpHelpLightbox" class="erp-help-lightbox hidden" role="dialog" aria-modal="true" aria-label="Captura ampliada"><button type="button" data-help-lightbox-close aria-label="Fechar captura">${iconMarkup("x")}</button><img alt=""></div>`;
}

function listPage(title, description, articles, emptyMessage = "Nenhum guia disponível nesta categoria para seu perfil.") {
  return `<section class="erp-help-list-page"><header><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></header>${articles.length ? `<div class="erp-help-article-list">${articles.map(articleListItem).join("")}</div>` : emptyState("Nenhum guia encontrado", emptyMessage)}</section>`;
}

function articleCard(article) {
  return `<button type="button" class="erp-help-card" data-help-article="${escapeAttr(article.id)}"><span>${iconMarkup(categoryIcon(article.category))}</span><strong>${escapeHtml(article.title)}</strong><small>${escapeHtml(article.description)}</small><em>Ver guia ${iconMarkup("arrow-right")}</em></button>`;
}

function articleListItem(article) {
  const category = HELP_CATEGORIES.find((item) => item.id === article.category);
  return `<button type="button" class="erp-help-list-item" data-help-article="${escapeAttr(article.id)}"><span>${iconMarkup(category?.icon || "book-open")}</span><span><small>${escapeHtml(category?.label || article.category)}</small><strong>${escapeHtml(article.title)}</strong><em>${escapeHtml(article.description)}</em></span>${iconMarkup("chevron-right")}</button>`;
}

function emptyState(title, message) {
  return `<div class="erp-help-empty">${iconMarkup("book-open-check")}<strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p></div>`;
}

function categoryIcon(categoryId) {
  return HELP_CATEGORIES.find((item) => item.id === categoryId)?.icon || "book-open";
}

function createNoopController() {
  return { open() {}, close() {}, closeIfOpen() { return false; }, refresh() {} };
}

function sameView(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function number(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}
