(() => {
  setupMobileNavigation();

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

})();
