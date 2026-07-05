export function setActiveNavigation(nav, moduleKey) {
  nav.querySelectorAll("[data-module-link]").forEach((link) => {
    link.classList.toggle("active", link.dataset.moduleLink === moduleKey);
  });
}
