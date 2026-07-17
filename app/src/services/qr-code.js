import qrcode from "qrcode-generator";

export function createQrCodeSvg(value, { cellSize = 8, margin = 4 } = {}) {
  const qr = qrcode(0, "M");
  qr.addData(String(value), "Byte");
  qr.make();
  return qr.createSvgTag({ cellSize, margin, scalable: true });
}
