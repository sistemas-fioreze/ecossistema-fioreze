const STYLESHEET_HREF = "/css/modules/admin/admin-shell-open-corner.css?v=20260902-1";

if (typeof document !== "undefined" && !document.querySelector("link[data-admin-shell-open-corner]")) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = STYLESHEET_HREF;
  link.dataset.adminShellOpenCorner = "";
  document.head.append(link);
}
