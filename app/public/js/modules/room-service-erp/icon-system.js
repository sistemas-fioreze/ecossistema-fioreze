const ICON_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function iconMarkup(name, className = "") {
  if (!ICON_NAME_PATTERN.test(name)) throw new TypeError(`Invalid Lucide icon name: ${name}`);
  const classes = String(className || "").trim();
  return `<i data-lucide="${name}"${classes ? ` class="${classes}"` : ""} aria-hidden="true"></i>`;
}

export function setupIconSystem(root = document) {
  const runtime = globalThis.FiorezeLucide;
  if (!runtime?.createIcons || !runtime?.icons) throw new Error("Lucide ERP bundle is unavailable.");

  const render = () => runtime.createIcons({
    icons: runtime.icons,
    attrs: {
      "stroke-width": "1.9",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    },
    root,
  });

  render();

  let scheduled = false;
  const observer = new MutationObserver((mutations) => {
    const hasPlaceholder = mutations.some((mutation) => [...mutation.addedNodes].some((node) => {
      if (!(node instanceof Element)) return false;
      return node.matches("i[data-lucide]") || Boolean(node.querySelector("i[data-lucide]"));
    }));
    if (!hasPlaceholder || scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      render();
    });
  });
  observer.observe(root.documentElement || root, { childList: true, subtree: true });
  return () => observer.disconnect();
}
