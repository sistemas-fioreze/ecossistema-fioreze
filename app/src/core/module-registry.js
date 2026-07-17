import { registerFutureModuleRoutes } from "../modules/future/routes.js";
import { registerGuestPortalRoutes } from "../modules/guest-portal/routes.js";
import { registerRoomServiceRoutes } from "../modules/room-service/routes.js";

export const MODULES = [
  {
    module_key: "guest-portal",
    name: "Portal do Hospede",
    status: "functional-foundation",
    registerRoutes: registerGuestPortalRoutes,
  },
  {
    module_key: "room-service",
    name: "Room Service",
    status: "functional-foundation",
    registerRoutes: registerRoomServiceRoutes,
  },
  {
    module_key: "emporio",
    name: "Emporio",
    status: "planned",
  },
  {
    module_key: "spa",
    name: "Spa",
    status: "planned",
  },
  {
    module_key: "romantic-packages",
    name: "Pacotes Romanticos",
    status: "planned",
  },
  {
    module_key: "admin",
    name: "ERP Administrativo",
    status: "protected-foundation",
  },
];

export function registerModuleRoutes(router) {
  registerFutureModuleRoutes(router);
  for (const module of MODULES) {
    if (typeof module.registerRoutes === "function") {
      module.registerRoutes(router);
    }
  }
}

export function getRegisteredModule(moduleKey) {
  return MODULES.find((module) => module.module_key === moduleKey) || null;
}
