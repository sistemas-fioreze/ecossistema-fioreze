const STYLESHEET_HREF = "/css/modules/room-service-erp/desktop-loading-experience.css?v=20260819-3";
const SLOW_NOTICE_DELAY = 7000;
const RETRY_DELAY = 12000;

export function setupDesktopLoadingExperience(root = document) {
  if (!window.fiorezeDesktop?.isElectron) return;

  const screen = root.getElementById("loginLoadingScreen");
  if (!screen || screen.dataset.desktopLoadingReady === "true") return;

  ensureStyles(root);
  screen.dataset.desktopLoadingReady = "true";
  screen.classList.add("desktop-loading-screen");

  const originalMessage = root.getElementById("loginLoadingText")?.textContent?.trim() || "Verificando sessao...";
  screen.replaceChildren(buildExperience(root, originalMessage));

  const bridge = root.getElementById("loginLoadingText");
  const visibleStatus = root.getElementById("desktopLoadingStatus");
  const slowNotice = root.getElementById("desktopLoadingSlow");
  const retry = root.getElementById("desktopLoadingRetry");

  let slowTimer = 0;
  let retryTimer = 0;

  const syncMessage = () => {
    if (!bridge || !visibleStatus) return;
    visibleStatus.textContent = friendlyStatus(bridge.textContent);
  };

  const clearTimers = () => {
    window.clearTimeout(slowTimer);
    window.clearTimeout(retryTimer);
    slowTimer = 0;
    retryTimer = 0;
  };

  const resetWaitState = () => {
    clearTimers();
    slowNotice?.classList.add("hidden");
    retry?.classList.add("hidden");

    if (screen.classList.contains("hidden")) return;

    slowTimer = window.setTimeout(() => {
      slowNotice?.classList.remove("hidden");
    }, SLOW_NOTICE_DELAY);

    retryTimer = window.setTimeout(() => {
      retry?.classList.remove("hidden");
    }, RETRY_DELAY);
  };

  bridge && new MutationObserver(syncMessage).observe(bridge, { childList: true, characterData: true, subtree: true });
  new MutationObserver(resetWaitState).observe(screen, { attributes: true, attributeFilter: ["class"] });

  retry?.addEventListener("click", async () => {
    retry.disabled = true;
    retry.textContent = "Recarregando...";
    try {
      if (typeof window.fiorezeDesktop?.reload === "function") {
        await window.fiorezeDesktop.reload();
      } else {
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  });

  syncMessage();
  resetWaitState();
}

function buildExperience(root, initialMessage) {
  const experience = root.createElement("section");
  experience.className = "desktop-loading-experience";
  experience.setAttribute("role", "status");
  experience.setAttribute("aria-live", "polite");
  experience.innerHTML = `
    <h2 class="desktop-loading-title" id="loginLoadingTitle">Preparando seu ambiente</h2>
    <p class="desktop-loading-subtitle">Estamos deixando tudo pronto para você.</p>
    <div class="desktop-loading-progress" aria-hidden="true"><span></span></div>
    <p class="desktop-loading-status" id="desktopLoadingStatus">${escapeHtml(friendlyStatus(initialMessage))}</p>
    <span id="loginLoadingText" class="desktop-loading-bridge" aria-hidden="true">${escapeHtml(initialMessage)}</span>
    <p class="desktop-loading-slow hidden" id="desktopLoadingSlow">Isso está levando um pouco mais de tempo.</p>
    <button type="button" class="desktop-loading-retry hidden" id="desktopLoadingRetry">Tentar novamente</button>
  `;
  return experience;
}

function friendlyStatus(message = "") {
  const normalized = String(message).trim().toLowerCase();
  if (normalized.includes("verificando sess")) return "Validando sua sessão";
  if (normalized.includes("usuario") || normalized.includes("usuário") || normalized.includes("senha")) return "Validando seu acesso";
  if (normalized.includes("sincron")) return "Sincronizando o ERP";
  if (!normalized) return "Conectando ao sistema";
  return String(message).replace(/\.{3}$/u, "");
}

function ensureStyles(root) {
  if (root.querySelector('link[data-erp-desktop-loading]')) return;
  const link = root.createElement("link");
  link.rel = "stylesheet";
  link.href = STYLESHEET_HREF;
  link.dataset.erpDesktopLoading = "";
  root.head.append(link);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
