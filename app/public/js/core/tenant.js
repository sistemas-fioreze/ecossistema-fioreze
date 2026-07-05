export function resolveSlugFromPath(pathname = window.location.pathname) {
  const [slug] = pathname.split("/").filter(Boolean);
  return slug || null;
}

export function resolveModuleFromPath(pathname = window.location.pathname, fallback = "guest-portal") {
  const parts = pathname.split("/").filter(Boolean);
  return parts[1] || fallback;
}
