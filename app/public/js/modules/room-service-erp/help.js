import { HELP_ARTICLES, HELP_CATEGORIES, HELP_ROUTE_LABELS } from "./help-content.js?v=20260820-5";
import { iconMarkup } from "./icon-system.js";

export function canAccessHelpArticle(article, { permissions = [], isElectron = false, isMaster = false } = {}) {
  const platforms = article.platforms || ["web", "electron"];
  if (!platforms.includes(isElectron ? "electron" : "web")) return false;
  if (isMaster || !(article.permissions || []).length) return true;
  const allowed = new Set(permissions);
  return article.permissions.every((permission) => allowed.has(permission));
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

  const state = { view: { type: "home" }, history: [], lastFocus: null };
  const dialog = root.querySelector(".erp-help-dialog");
  const content = root.querySelector("#erpHelpContent");
  const lightbox = root.querySelector("#erpHelpLightbox");

  helpButton.addEventListener("click", open);
  root.addEventListener("click", handleClick);
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
    state.history = [];
    render();
    requestAnimationFrame(() => content.focus());
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
    if (action === "context") return navigate({ type: "context", route: activeRoute() });
    const category = event.target.closest("[data-help-category]")?.dataset.helpCategory;
    if (category) return navigate({ type: "category", id: category });
    const article = event.target.closest("[data-help-article]")?.dataset.helpArticle;
    if (article) return navigate({ type: "article", id: article });
  }

  function handleKeydown(event) {
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
      state.history.push(state.view);
    }
    state.view = view;
    render();
  }

  function goBack() {
    state.view = state.history.pop() || { type: "home" };
    render();
  }

  function render() {
    const articles = availableArticles();
    renderNavigation(articles);
    if (state.view.type === "article") renderArticle(articles.find((article) => article.id === state.view.id), articles);
    else if (state.view.type === "category") renderCategory(state.view.id, articles);
    else if (state.view.type === "context") renderContext(state.view.route, articles);
    else renderHome(articles);
    content.scrollTop = 0;
  }

  function renderNavigation(articles) {
    root.querySelector("#erpHelpCategories").innerHTML = HELP_CATEGORIES.map((category) => {
      const count = articles.filter((article) => article.category === category.id).length;
      if (!count) return "";
      const viewedArticle = state.view.type === "article" ? articles.find((article) => article.id === state.view.id) : null;
      const active = (state.view.type === "category" && state.view.id === category.id) || viewedArticle?.category === category.id;
      return `<button type="button" class="erp-help-category${active ? " active" : ""}" data-help-category="${escapeAttr(category.id)}"${active ? ' aria-current="page"' : ""}>${iconMarkup(category.icon)}<span>${escapeHtml(category.label)}</span><small>${count}</small></button>`;
    }).join("");
  }

  function renderHome(articles) {
    const route = activeRoute();
    const contextual = articles.filter((article) => article.relatedRoutes.includes(route)).slice(0, 3);
    const contextualIds = new Set(contextual.map((article) => article.id));
    const popular = articles.filter((article) => article.popular && !contextualIds.has(article.id)).slice(0, 6);
    const routeLabel = HELP_ROUTE_LABELS[route] || "Esta tela";
    content.innerHTML = `<div class="erp-help-home">
      <section class="erp-help-hero"><h2>Como podemos ajudar?</h2><span>Encontre instruções para utilizar as principais funções do ERP.</span></section>
      <section class="erp-help-contextual"><p>Ajuda desta tela</p><div><strong>${escapeHtml(routeLabel)}</strong><button type="button" class="erp-help-text-action" data-help-action="context">Ver guias relacionados ${iconMarkup("arrow-right")}</button></div></section>
      ${contextual.length ? `<section class="erp-help-section"><div class="erp-help-section-head"><h3>Guias recomendados</h3></div><div class="erp-help-card-grid">${contextual.map(articleCard).join("")}</div></section>` : ""}
      ${popular.length ? `<section class="erp-help-section"><div class="erp-help-section-head"><h3>Guias populares</h3></div><div class="erp-help-card-grid">${popular.map(articleCard).join("")}</div></section>` : ""}
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

  function renderArticle(article, articles) {
    if (!article) {
      content.innerHTML = emptyState("Guia indisponível", "Este conteúdo não está disponível para sua conta ou plataforma.");
      return;
    }
    const category = HELP_CATEGORIES.find((item) => item.id === article.category);
    const related = (article.related || []).map((id) => articles.find((item) => item.id === id)).filter(Boolean).slice(0, 4);
    content.innerHTML = `<article class="erp-help-article">
      <header><button type="button" class="erp-help-breadcrumb" data-help-action="back">${iconMarkup("arrow-left")} Voltar</button><span class="erp-help-article-category">${escapeHtml(category?.label || article.category)}</span><h2>${escapeHtml(article.title)}</h2><p>${escapeHtml(article.description)}</p></header>
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
      <div class="erp-help-title"><span>${iconMarkup("circle-help")}</span><strong id="erpHelpTitle">Central de Ajuda</strong></div>
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
