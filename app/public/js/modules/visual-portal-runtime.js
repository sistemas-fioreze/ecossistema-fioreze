(() => {
  setupMobileNavigation();
  setupInstallation();

  function setupMobileNavigation() {
    const header = document.querySelector(".site-header");
    const toggle = header?.querySelector("[data-mobile-menu-toggle]");
    const panel = document.querySelector(".mobile-navigation");
    if (!header || !toggle || !panel) return;

    const setOpen = (open) => {
      header.classList.toggle("menu-open", open);
      document.body.classList.toggle("portal-menu-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      panel.setAttribute("aria-hidden", String(!open));
      if (open) panel.querySelector("a,button")?.focus();
      else toggle.focus({ preventScroll: true });
    };

    toggle.addEventListener("click", () => setOpen(!header.classList.contains("menu-open")));
    document.querySelectorAll("[data-mobile-menu-close]").forEach((control) => control.addEventListener("click", () => setOpen(false)));
    panel.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setOpen(false)));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && header.classList.contains("menu-open")) setOpen(false);
    });
  }

  function setupInstallation() {
    const root = document.documentElement;
    if (root.dataset.installEnabled !== "true") return;

    const buttons = [...document.querySelectorAll("[data-install-app]")];
    const workerUrl = root.dataset.serviceWorker;
    const workerScope = root.dataset.serviceWorkerScope;
    const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    if (standalone) {
      buttons.forEach((button) => { button.hidden = true; });
      return;
    }

    let installPrompt = null;
    let registrationPromise = Promise.resolve(null);
    if ("serviceWorker" in navigator && workerUrl && workerScope) {
      registrationPromise = navigator.serviceWorker.register(workerUrl, { scope: workerScope }).catch(() => null);
    }

    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      installPrompt = event;
      buttons.forEach((button) => { button.hidden = false; button.disabled = false; });
    });

    buttons.forEach((button) => button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await registrationPromise;
        if (installPrompt) {
          await installPrompt.prompt();
          await installPrompt.userChoice;
          installPrompt = null;
          buttons.forEach((item) => { item.hidden = true; });
          return;
        }
        showRuntimeToast(isAppleMobile()
          ? "No Safari, toque em Compartilhar e depois em Adicionar à Tela de Início."
          : "A instalação estará disponível no menu do navegador assim que os requisitos do dispositivo forem concluídos.");
      } finally {
        button.disabled = false;
      }
    }));

    window.addEventListener("appinstalled", () => {
      installPrompt = null;
      buttons.forEach((button) => { button.hidden = true; });
      showRuntimeToast("Aplicativo instalado com sucesso.");
    });
  }

  function showRuntimeToast(message) {
    document.querySelector(".portal-runtime-toast")?.remove();
    const toast = document.createElement("div");
    toast.className = "portal-runtime-toast";
    toast.setAttribute("role", "status");
    toast.textContent = message;
    document.body.append(toast);
    window.setTimeout(() => toast.remove(), 6000);
  }

  function isAppleMobile() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }
})();
