const REQUIRED_CLICKS = 7;
const CLICK_WINDOW_MS = 4200;
const FUNNY_VERSIONS = [
  "v0.0.1-final-FINAL-agora-vai-37",
  "v2.7-cloudflare-mas-o-css-quebrou",
  "v4.2-electron-era-mais-facil-na-planilha",
  "v6.9-nao-mexe-que-ta-funcionando",
  "v7.0-codex-fez-e-eu-corrigi",
  "v8.4-so-mais-uma-coisinha",
  "v9.9-definitivamente-ultima-versao",
  "v10.0-final-finalissimo-REV3",
  "v2026.8-gepe-approved",
  "v∞-em-desenvolvimento",
];

let previousFocus = null;
let audioContext = null;

export function createSecretClickTracker({
  requiredClicks = REQUIRED_CLICKS,
  windowMs = CLICK_WINDOW_MS,
} = {}) {
  let clickCount = 0;
  let firstClickAt = null;

  return (now = Date.now()) => {
    if (firstClickAt === null || now - firstClickAt > windowMs) {
      firstClickAt = now;
      clickCount = 0;
    }

    clickCount += 1;
    if (clickCount < requiredClicks) return false;

    clickCount = 0;
    firstClickAt = null;
    return true;
  };
}

export function setupErpEasterEgg(root = document) {
  const registerSecretClick = createSecretClickTracker();
  const handleClick = (event) => {
    if (event.target.closest("[data-wesley-easter-close]")) {
      closeEasterEgg(root);
      return;
    }

    if (event.target === root.querySelector("#wesleyEasterOverlay")) {
      closeEasterEgg(root);
      return;
    }

    if (event.target.closest("#wesleyWordart")) {
      root.querySelector("#wesleySecretMessage")?.classList.add("visible");
      playSecretSound();
      return;
    }

    if (!event.target.closest("[data-wesley-easter-trigger]")) return;
    if (registerSecretClick()) openEasterEgg(root);
  };

  const handleKeydown = (event) => {
    const overlay = root.querySelector("#wesleyEasterOverlay");
    if (!overlay?.classList.contains("active")) return;

    if (event.key === "Escape") {
      event.preventDefault();
      closeEasterEgg(root);
      return;
    }

    if (event.key !== "Tab") return;
    const controls = [...overlay.querySelectorAll("button:not([disabled])")];
    if (!controls.length) return;
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && root.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && root.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  root.addEventListener("click", handleClick);
  root.addEventListener("keydown", handleKeydown);
  return () => {
    root.removeEventListener("click", handleClick);
    root.removeEventListener("keydown", handleKeydown);
    root.querySelector("#wesleyEasterOverlay")?.remove();
  };
}

function openEasterEgg(root) {
  let overlay = root.querySelector("#wesleyEasterOverlay");
  if (!overlay) {
    root.body.insertAdjacentHTML("beforeend", easterEggMarkup());
    overlay = root.querySelector("#wesleyEasterOverlay");
  }

  const funnyVersion = overlay.querySelector("#wesleyFunnyVersion");
  funnyVersion.textContent = FUNNY_VERSIONS[Math.floor(Math.random() * FUNNY_VERSIONS.length)];
  overlay.querySelector("#wesleySecretMessage").classList.remove("visible");
  previousFocus = root.activeElement;
  overlay.classList.add("active");
  overlay.setAttribute("aria-hidden", "false");
  root.body.classList.add("wesley-easter-open");

  const windowElement = overlay.querySelector("#wesleyRetroWindow");
  windowElement.classList.remove("opening");
  void windowElement.offsetWidth;
  windowElement.classList.add("opening");
  playStartupSound();
  setTimeout(() => overlay.querySelector("#wesleyOkButton")?.focus(), 100);
}

function closeEasterEgg(root) {
  const overlay = root.querySelector("#wesleyEasterOverlay");
  if (!overlay?.classList.contains("active")) return;
  overlay.classList.remove("active");
  overlay.setAttribute("aria-hidden", "true");
  root.body.classList.remove("wesley-easter-open");
  if (previousFocus instanceof HTMLElement) previousFocus.focus();
  previousFocus = null;
}

function easterEggMarkup() {
  return `<div class="wesley-easter-overlay" id="wesleyEasterOverlay" aria-hidden="true">
    <div class="wesley-retro-window" id="wesleyRetroWindow" role="dialog" aria-modal="true" aria-label="Sobre este programa">
      <div class="wesley-titlebar">
        <span class="wesley-titlebar-text">Sobre este programa</span>
        <button class="wesley-close-button" id="wesleyCloseButton" type="button" data-wesley-easter-close aria-label="Fechar">×</button>
      </div>
      <div class="wesley-window-content">
        <div class="wesley-wordart-area">
          <div class="wesley-wordart-grid" aria-hidden="true"></div>
          <span class="wesley-star one" aria-hidden="true">★</span>
          <span class="wesley-star two" aria-hidden="true">✦</span>
          <span class="wesley-star three" aria-hidden="true">★</span>
          <span class="wesley-star four" aria-hidden="true">✧</span>
          <div class="wesley-wordart-wrapper">
            <div class="wesley-wordart" id="wesleyWordart">WESLEY<br>LACERDA</div>
            <div class="wesley-wordart-subtitle">certified computer person</div>
          </div>
        </div>
        <div class="wesley-info-panel">
          <div class="wesley-info-row"><span class="wesley-label">Produto:</span><span>ERP</span></div>
          <div class="wesley-info-row"><span class="wesley-label">Criador:</span><span>Wesley Lacerda</span></div>
          <div class="wesley-info-row"><span class="wesley-label">Versão:</span><span class="wesley-version" id="wesleyFunnyVersion"></span></div>
          <div class="wesley-info-row"><span class="wesley-label">Build:</span><span>*preciso de um café</span></div>
          <div class="wesley-info-row"><span class="wesley-label">Status:</span><span>"por incrível q pareça, tá funcionando"</span></div>
          <div class="wesley-info-row"><span class="wesley-label">Histórico:</span><span>planilha → Apps Script → Python → Cloudflare → D1 → Electron → "só mais uma coisinha"</span></div>
        </div>
        <div class="wesley-marquee-shell" aria-hidden="true"><div class="wesley-marquee">★ ESTE ERP SOBREVIVEU A REDESIGNS, MIGRAÇÕES, IMPRESSORAS TÉRMICAS, CLOUDFLARE, ELECTRON E INÚMEROS "GEPE FAZ UM PROMPT PRA MIM" ★</div></div>
        <div class="wesley-secret-message" id="wesleySecretMessage">Parabéns. Você clicou até encontrar o desenvolvedor.</div>
        <div class="wesley-actions"><button class="wesley-retro-button" id="wesleyOkButton" type="button" data-wesley-easter-close>OK</button></div>
      </div>
    </div>
  </div>`;
}

function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext || audioContext.state === "closed") audioContext = new AudioContextClass();
  if (audioContext.state === "suspended") void audioContext.resume();
  return audioContext;
}

function playStartupSound() {
  const context = getAudioContext();
  if (!context) return;
  [[523, 0], [659, 0.09], [784, 0.18]].forEach(([frequency, delay]) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.055, context.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + delay + 0.22);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(context.currentTime + delay);
    oscillator.stop(context.currentTime + delay + 0.23);
  });
}

function playSecretSound() {
  const context = getAudioContext();
  if (!context) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(900, context.currentTime);
  oscillator.frequency.setValueAtTime(1200, context.currentTime + 0.07);
  gain.gain.setValueAtTime(0.025, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.16);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.17);
}
