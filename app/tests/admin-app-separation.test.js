import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccessPortals,
  canAccessMediaLibrary,
  canAccessLinks,
  canAccessRoomService,
  getAuthorizedHotels,
  hasPermission,
} from "../public/js/modules/admin/shared/admin-session.js";
import { createWorkerTestContext } from "./helpers/worker.js";

test("usuario com room-service.orders.read ve Room Service e nao ganha Portais por inferencia", () => {
  const session = {
    permissions: ["room-service.orders.read", "room-service.orders.write"],
    hotels: [{ hotel_id: "muller-fioreze" }],
  };

  assert.equal(canAccessRoomService(session), true);
  assert.equal(canAccessPortals(session), false);
  assert.equal(canAccessMediaLibrary(session), false);
  assert.equal(hasPermission(session, "room-service.orders.read"), true);
  assert.equal(getAuthorizedHotels(session).length, 1);
});

test("Central de Portais exige permissao platform ou portals", () => {
  assert.equal(canAccessPortals({ permissions: ["platform.hotels.read"] }), true);
  assert.equal(canAccessPortals({ permissions: ["portals.content.read"] }), true);
  assert.equal(canAccessPortals({ permissions: ["portals.media.read"] }), true);
  assert.equal(canAccessPortals({ permissions: ["portals.links.read"] }), true);
  assert.equal(canAccessPortals({ permissions: ["room-service.orders.read"] }), false);
  assert.equal(canAccessPortals({ permissions: [] }), false);
});

test("Biblioteca de imagens exige permissao especifica de leitura", () => {
  assert.equal(canAccessMediaLibrary({ permissions: ["portals.media.read"] }), true);
  assert.equal(canAccessMediaLibrary({ permissions: ["portals.media.upload"] }), false);
  assert.equal(canAccessMediaLibrary({ permissions: ["platform.hotels.read"] }), false);
});

test("Links personalizados exigem permissao especifica de leitura", () => {
  assert.equal(canAccessLinks({ permissions: ["portals.links.read"] }), true);
  assert.equal(canAccessLinks({ permissions: ["portals.links.create"] }), false);
  assert.equal(canAccessLinks({ permissions: ["platform.hotels.read"] }), false);
});

test("ausencia de sessao na central nao entrega conteudo operacional de pedidos", async () => {
  const { fetch } = createWorkerTestContext();
  const response = await fetch("/admin/", { redirect: "manual" });
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /loginForm/);
  assert.doesNotMatch(html, /ordersList/);
  assert.doesNotMatch(html, /Detalhes do pedido/);
});
