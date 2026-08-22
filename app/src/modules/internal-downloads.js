import {
  PRINT_AGENT_RELEASE_FILE_PATTERN,
  PRINT_AGENT_RELEASE_PREFIX,
  RELEASE_FILE_PATTERN,
  RELEASE_PREFIX,
  serveLatestDesktopInstaller,
  serveLatestPrintAgentInstaller,
} from "./desktop-releases.js";

const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

export async function serveInternalDownloadCenter({ env, head = false }) {
  const [erp, suite] = await Promise.all([
    resolveErpRelease(env),
    resolveSuiteRelease(env),
  ]);

  const html = renderDownloadCenter({ erp, suite });
  return new Response(head ? null : html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

export function serveInternalInstaller({ env, product, head = false }) {
  if (product === "erp") return serveLatestDesktopInstaller({ env, head });
  if (product === "suite") return serveLatestPrintAgentInstaller({ env, head });
  return new Response(JSON.stringify({ error: { code: "not_found", message: "Download não encontrado." } }), {
    status: 404,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

async function resolveErpRelease(env) {
  if (!env?.MEDIA_BUCKET) return unavailableRelease("Fioreze ERP");
  const object = await env.MEDIA_BUCKET.get(`${RELEASE_PREFIX}latest.yml`);
  if (!object?.body) return unavailableRelease("Fioreze ERP");

  const manifest = await new Response(object.body).text();
  const version = manifest.match(/^version:\s*["']?([^\s"']+)["']?\s*$/m)?.[1] || "";
  const manifestPath = manifest.match(/^path:\s*["']?([^\r\n"']+)["']?\s*$/m)?.[1]?.trim();
  const filename = manifestPath?.split("/").at(-1) || `Fioreze-ERP-Setup-${version}.exe`;
  if (!VERSION_PATTERN.test(version) || !RELEASE_FILE_PATTERN.test(filename) || !filename.endsWith(".exe")) {
    return unavailableRelease("Fioreze ERP");
  }

  const installer = await env.MEDIA_BUCKET.head(`${RELEASE_PREFIX}${filename}`);
  if (!installer) return unavailableRelease("Fioreze ERP");
  return {
    name: "Fioreze ERP",
    description: "Aplicativo desktop do ERP Fioreze para Windows.",
    version,
    filename,
    size: installer.size,
    href: "/internal/download/erp",
    available: true,
  };
}

async function resolveSuiteRelease(env) {
  if (!env?.MEDIA_BUCKET) return unavailableRelease("Fioreze Suite");
  const object = await env.MEDIA_BUCKET.get(`${PRINT_AGENT_RELEASE_PREFIX}latest.json`);
  if (!object?.body) return unavailableRelease("Fioreze Suite");

  let manifest;
  try {
    manifest = JSON.parse(await new Response(object.body).text());
  } catch {
    return unavailableRelease("Fioreze Suite");
  }

  const version = String(manifest?.version || "").trim();
  const filename = String(manifest?.file || `Fioreze-Suite-${version}.exe`).trim();
  if (!VERSION_PATTERN.test(version) || !PRINT_AGENT_RELEASE_FILE_PATTERN.test(filename) || !filename.endsWith(".exe")) {
    return unavailableRelease("Fioreze Suite");
  }

  const installer = await env.MEDIA_BUCKET.head(`${PRINT_AGENT_RELEASE_PREFIX}${filename}`);
  if (!installer) return unavailableRelease("Fioreze Suite");
  return {
    name: "Fioreze Suite",
    description: "Serviços locais, impressão e instalação assistida para os computadores das unidades.",
    version,
    filename,
    size: installer.size,
    href: "/internal/download/suite",
    available: true,
  };
}

function unavailableRelease(name) {
  return {
    name,
    description: name === "Fioreze ERP"
      ? "Aplicativo desktop do ERP Fioreze para Windows."
      : "Serviços locais, impressão e instalação assistida para os computadores das unidades.",
    version: "",
    filename: "",
    size: null,
    href: "#",
    available: false,
  };
}

function renderDownloadCenter({ erp, suite }) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Fioreze · Downloads internos</title>
  <style>
    :root{font-family:Inter,"Segoe UI",Arial,sans-serif;color:#202124;background:#f6f7f8;color-scheme:light}
    *{box-sizing:border-box}body{margin:0;min-height:100vh;background:#f6f7f8;padding:48px 24px;color:#202124}
    main{width:min(940px,100%);margin:0 auto}.eyebrow{margin:0 0 8px;color:#7a8088;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em}
    h1{margin:0;font-size:34px;line-height:1.1;letter-spacing:-.035em;font-weight:700}.intro{max-width:680px;margin:12px 0 30px;color:#68707a;font-size:15px;line-height:1.6}
    .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.card{background:#fff;border:1px solid #e5e8eb;border-radius:18px;padding:24px;display:flex;flex-direction:column;min-height:290px}
    .icon{width:42px;height:42px;border-radius:12px;background:#202124;color:#fff;display:grid;place-items:center;font-weight:800;margin-bottom:22px}.card h2{margin:0;font-size:20px}.description{margin:7px 0 20px;color:#737b85;line-height:1.5;font-size:13px}
    .version{display:inline-flex;align-self:flex-start;border:1px solid #e2e5e8;background:#f8f9fa;border-radius:999px;padding:5px 9px;color:#56606c;font-size:11px;font-weight:700}.file{margin:10px 0 22px;color:#9097a0;font-size:11px;overflow-wrap:anywhere}
    .button{margin-top:auto;min-height:46px;border-radius:12px;background:#202124;color:#fff;text-decoration:none;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700}.button:hover{background:#343a40}.button.disabled{background:#e8eaed;color:#9299a2;pointer-events:none}
    footer{margin-top:20px;color:#9399a1;font-size:11px;line-height:1.5}.internal{display:inline-flex;margin-bottom:18px;padding:6px 9px;border-radius:8px;background:#eceff1;color:#626a74;font-size:11px;font-weight:700}
    @media(max-width:700px){body{padding:32px 16px}.grid{grid-template-columns:1fr}h1{font-size:29px}.card{min-height:260px}}
  </style>
</head>
<body>
  <main>
    <span class="internal">Uso interno</span>
    <p class="eyebrow">Hotéis Fioreze</p>
    <h1>Central de downloads</h1>
    <p class="intro">Instaladores oficiais para os computadores da operação. Os botões abaixo consultam o mesmo canal de releases usado pelas atualizações automáticas e sempre entregam a versão mais recente publicada.</p>
    <section class="grid">
      ${renderProductCard(erp, "E")}
      ${renderProductCard(suite, "S")}
    </section>
    <footer>Os manifests e arquivos versionados de atualização permanecem disponíveis apenas para os aplicativos. Esta página não é indexada por mecanismos de busca.</footer>
  </main>
</body>
</html>`;
}

function renderProductCard(release, mark) {
  const available = Boolean(release?.available);
  const version = available ? `Versão ${escapeHtml(release.version)}` : "Indisponível no momento";
  const file = available
    ? `${escapeHtml(release.filename)}${release.size == null ? "" : ` · ${escapeHtml(formatBytes(release.size))}`}`
    : "O release publicado não pôde ser localizado.";
  const buttonClass = available ? "button" : "button disabled";
  const href = available ? release.href : "#";
  return `<article class="card">
    <div class="icon" aria-hidden="true">${mark}</div>
    <h2>${escapeHtml(release.name)}</h2>
    <p class="description">${escapeHtml(release.description)}</p>
    <span class="version">${version}</span>
    <div class="file">${file}</div>
    <a class="${buttonClass}" href="${href}"${available ? "" : ' aria-disabled="true"'}>Baixar instalador</a>
  </article>`;
}

function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
