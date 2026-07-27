const MODULE_LOADERS = {
  "guest-portal": () => import("./portal-home.js"),
  "room-service": () => import("../modules/room-service/index.js"),
  emporio: () => import("../modules/emporio/index.js"),
};

export async function loadModule(moduleKey) {
  const loader = MODULE_LOADERS[moduleKey];
  if (!loader) {
    return {
      render(container) {
        container.innerHTML = `
          <section class="panel">
            <p class="eyebrow">Modulo em preparacao</p>
            <h2>Esta experiencia ainda nao esta disponivel nesta base local.</h2>
          </section>
        `;
      },
    };
  }
  return loader();
}
