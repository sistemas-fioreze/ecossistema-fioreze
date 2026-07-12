export function createRouter({ routes, fallbackRoute = "dashboard" }) {
  return {
    async render(route, context) {
      const selected = routes[route] ? route : fallbackRoute;
      await routes[selected](context);
      return selected;
    },
  };
}
