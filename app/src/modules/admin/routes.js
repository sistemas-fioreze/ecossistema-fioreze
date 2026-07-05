import { requireAuthentication } from "../../middleware/authentication.js";

export function registerAdminRoutes(router) {
  router.get("/api/v1/admin/session", async () => {
    await requireAuthentication();
  });
  router.all("/api/v1/admin/*", async () => {
    await requireAuthentication();
  });
}
