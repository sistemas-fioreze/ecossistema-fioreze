import { render as renderRoomService } from "./room-service/index.js";

const mount = document.querySelector("[data-visual-room-service]");

if (mount) {
  bootRoomServicePage(mount);
}

async function bootRoomServicePage(container) {
  const hotelSlug = String(container.dataset.hotelSlug || "").trim().toLowerCase();
  try {
    await renderRoomService(container, {
      hotelSlug,
      moduleKey: "room-service",
      presentation: "portal-page",
    });
  } catch (error) {
    renderUnavailable(container, error);
  }
}

function renderUnavailable(container, error) {
  container.replaceChildren();
  const section = document.createElement("section");
  section.className = "visual-room-service-error";
  const title = document.createElement("h1");
  title.textContent = "Cardápio indisponível";
  const text = document.createElement("p");
  text.textContent = error?.message || "Não foi possível abrir o cardápio agora. Tente novamente em instantes.";
  section.append(title, text);
  container.append(section);
}
