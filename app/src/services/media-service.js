export function publicAssetUrl(path) {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    throw new Error("Assets remotos nao sao permitidos nesta fase.");
  }
  return path.startsWith("/") ? path : `/${path}`;
}
