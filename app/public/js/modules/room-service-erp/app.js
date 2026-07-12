import { renderBilling } from "./billing.js";
import { renderCatalog } from "./catalog.js";
import { renderDashboard } from "./dashboard.js";
import { renderGuests } from "./guests.js";
import { createHotelContext, renderHotelOptions, updateBranding } from "./hotel-context.js";
import { renderOrders, fetchOrderDetail, loadOrdersForHotel } from "./orders.js";
import { renderPos } from "./pos.js";
import { createRouter } from "./router.js";
import { createSessionController } from "./session.js";
import { renderSettings } from "./settings.js";
import { createShell } from "./shell.js";
import { NAV_ITEMS } from "./static-config.js";
import { clearIncompatibleCache, readPreferences, savePreferences } from "./storage.js";
import { notify } from "./notifications.js";

const state = {
  session: null,
  preferences: readPreferences(),
  hotelContext: { hotels: [], current: null },
  orders: [],
  selectedOrder: null,
  shell: null,
  loadingOrders: false,
};

const els = {
  outlet: document.getElementById("routeOutlet"),
  hotelSelect: document.getElementById("hotelSelect"),
  brandName: document.getElementById("hotelBrandName"),
  brandSubtitle: document.getElementById("hotelBrandSubtitle"),
  seal: document.getElementById("hotelSeal"),
  storeStatusButton: document.getElementById("storeStatusButton"),
  storeStatusText: document.getElementById("storeStatusText"),
  globalSearch: document.getElementById("globalSearch"),
};

clearIncompatibleCache();

const router = createRouter({
  routes: {
    dashboard: renderDashboardRoute,
    orders: renderOrdersRoute,
    pos: renderPosRoute,
    guests: renderGuestsRoute,
    billing: renderBillingRoute,
    catalog: renderCatalogRoute,
    settings: renderSettingsRoute,
  },
});

const session = createSessionController({
  async onAuthenticated(payload) {
    state.session = payload;
    await bootApplication();
  },
  onLoggedOut() {
    state.session = null;
    state.orders = [];
    state.selectedOrder = null;
  },
  onError(message) {
    notify(message);
  },
});

session.boot();

async function bootApplication() {
  state.hotelContext = createHotelContext({ session: state.session, preferences: state.preferences });
  if (!state.hotelContext.hotels.length) {
    els.outlet.innerHTML = '<section class="rs-panel"><div class="rs-empty">Nenhuma unidade autorizada para este usuario.</div></section>';
    return;
  }

  renderHotelOptions(els.hotelSelect, state.hotelContext.hotels, state.hotelContext.current?.hotel_id);
  updateBranding({ hotel: state.hotelContext.current, elements: brandingElements() });
  updateStoreStatus("unknown");

  state.shell = createShell({
    session: state.session,
    preferences: state.preferences,
    onNavigate: navigate,
    onHotelChange: switchHotel,
    onPreferenceChange: updatePreferences,
  });

  await refreshOrders();
  await navigate(state.preferences.route || "dashboard");
}

async function navigate(route) {
  const allowed = allowedRoutes();
  const nextRoute = allowed.includes(route) ? route : allowed[0] || "settings";
  state.preferences = savePreferences({ ...state.preferences, route: nextRoute });
  state.shell?.setRoute(nextRoute);
  await router.render(nextRoute, {
    outlet: els.outlet,
    session: state.session,
    hotel: state.hotelContext.current,
    orders: state.orders,
    selectedOrder: state.selectedOrder,
    preferences: state.preferences,
  });
}

async function switchHotel(hotelId) {
  const next = state.hotelContext.hotels.find((hotel) => hotel.hotel_id === hotelId);
  if (!next) return;
  state.hotelContext.current = next;
  state.selectedOrder = null;
  state.preferences = savePreferences({ ...state.preferences, preferredHotelId: next.hotel_id });
  updateBranding({ hotel: next, elements: brandingElements() });
  await refreshOrders();
  await navigate(state.preferences.route);
}

async function refreshOrders() {
  if (state.loadingOrders || !state.hotelContext.current) return;
  state.loadingOrders = true;
  try {
    state.orders = await loadOrdersForHotel({ hotelId: state.hotelContext.current.hotel_id, q: els.globalSearch.value.trim() });
    updateStoreStatus("open");
  } catch {
    state.orders = [];
    updateStoreStatus("unknown");
    notify("Nao foi possivel carregar pedidos do ERP.");
  } finally {
    state.loadingOrders = false;
  }
}

async function renderDashboardRoute(context) {
  renderDashboard(context);
}

async function renderOrdersRoute(context) {
  renderOrders({
    ...context,
    onSelect: async (orderId) => {
      state.selectedOrder = await fetchOrderDetail(orderId);
      await navigate("orders");
    },
  });
}

async function renderPosRoute(context) {
  renderPos(context);
}

async function renderGuestsRoute(context) {
  renderGuests(context);
}

async function renderBillingRoute(context) {
  renderBilling(context);
}

async function renderCatalogRoute(context) {
  renderCatalog(context);
}

async function renderSettingsRoute(context) {
  renderSettings(context);
}

function updatePreferences(patch) {
  state.preferences = savePreferences({ ...state.preferences, ...patch });
  state.shell?.applyPreferences(state.preferences);
  if (state.preferences.route === "settings") navigate("settings");
}

function allowedRoutes() {
  const permissions = new Set(state.session?.permissions || []);
  return NAV_ITEMS.filter((item) => permissions.has(item.permission)).map((item) => item.key);
}

function updateStoreStatus(status) {
  const stateName = status === "open" ? "open" : status === "closed" ? "closed" : "unknown";
  els.storeStatusButton.dataset.state = stateName;
  els.storeStatusText.textContent =
    stateName === "open" ? "Loja monitorada" : stateName === "closed" ? "Loja fechada" : "Status indisponivel";
}

function brandingElements() {
  return {
    brandName: els.brandName,
    brandSubtitle: els.brandSubtitle,
    seal: els.seal,
  };
}

els.globalSearch.addEventListener("input", async () => {
  if (state.preferences.route !== "orders" && state.preferences.route !== "dashboard") return;
  await refreshOrders();
  await navigate(state.preferences.route);
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && state.session) {
    refreshOrders().then(() => navigate(state.preferences.route));
  }
});
