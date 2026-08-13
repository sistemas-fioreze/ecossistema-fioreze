export const ERP_DESKTOP_TITLEBAR_HEIGHT = 44;

function cssNumber(value) {
  return Number(value.toFixed(6));
}

export function buildInterfaceViewport(factor, { isElectron = false } = {}) {
  if (!Number.isFinite(factor) || factor <= 0) {
    throw new TypeError("Interface scale factor must be a positive number");
  }

  const viewportPercent = cssNumber(100 / factor);
  const scaledTitlebarHeight = cssNumber(ERP_DESKTOP_TITLEBAR_HEIGHT / factor);

  return {
    width: `${viewportPercent}vw`,
    height: isElectron
      ? `calc(${viewportPercent}dvh - ${scaledTitlebarHeight}px)`
      : `${viewportPercent}dvh`,
  };
}
