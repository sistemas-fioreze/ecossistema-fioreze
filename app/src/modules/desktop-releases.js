const RELEASE_PREFIX = "desktop/erp/releases/";
const RELEASE_FILE_PATTERN = /^(?:latest\.yml|Fioreze-ERP-Setup-\d+\.\d+\.\d+\.exe(?:\.blockmap)?)$/;
const PRINT_AGENT_RELEASE_PREFIX = "desktop/print-agent/releases/";
const PRINT_AGENT_RELEASE_FILE_PATTERN = /^(?:latest\.json|Fioreze-Suite-\d+\.\d+\.\d+\.exe)$/;
const DESKTOP_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

export async function serveDesktopDownloadCenter({ env, head = false }) {
  const release = await resolveDesktopRelease(env);
  if (!release) return downloadCenterUnavailable({ head });

  const installerObject = await env.MEDIA_BUCKET.head(`${RELEASE_PREFIX}${release.filename}`);
  if (!installerObject) return downloadCenterUnavailable({ head });

  const blockmapObject = await env.MEDIA_BUCKET.head(`${RELEASE_PREFIX}${release.blockmap}`);
  const html = renderDesktopDownloadCenter({
    release,
    installerSize: installerObject.size,
    hasBlockmap: Boolean(blockmapObject),
  });
  const headers = new Headers({
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "x-robots-tag": "noindex, nofollow",
  });
  return new Response(head ? null : html, { status: 200, headers });
}

export async function serveLatestDesktopInstaller({ env, head = false }) {
  const release = await resolveDesktopRelease(env);
  if (!release) return releaseNotFound();
  return serveRelease({
    env,
    filename: release.filename,
    head,
    prefix: RELEASE_PREFIX,
    pattern: RELEASE_FILE_PATTERN,
    manifest: "latest.yml",
  });
}

export async function serveDesktopRelease({ env, params, head = false }) {
  const filename = String(params.file || "");
  if (filename === "download") return serveDesktopDownloadCenter({ env, head });
  if (filename === "installer") return serveLatestDesktopInstaller({ env, head });

  return serveRelease({
    env,
    filename,
    head,
    prefix: RELEASE_PREFIX,
    pattern: RELEASE_FILE_PATTERN,
    manifest: "latest.yml",
  });
}

export async function servePrintAgentRelease({ env, params, head = false }) {
  return serveRelease({
    env,
    filename: String(params.file || ""),
    head,
    prefix: PRINT_AGENT_RELEASE_PREFIX,
    pattern: PRINT_AGENT_RELEASE_FILE_PATTERN,
    manifest: "latest.json",
  });
}

async function resolveDesktopRelease(env) {
  if (!env?.MEDIA_BUCKET) return null;
  const manifestObject = await env.MEDIA_BUCKET.get(`${RELEASE_PREFIX}latest.yml`);
  if (!manifestObject?.body) return null;

  const manifest = await manifestObject.text();
  const version = manifest.match(/^version:\s*["']?([^\s"']+)["']?\s*$/m)?.[1] || "";
  if (!DESKTOP_VERSION_PATTERN.test(version)) return null;

  const manifestPath = manifest.match(/^path:\s*["']?([^\r\n"']+)["']?\s*$/m)?.[1]?.trim();
  const filename = manifestPath?.split("/").at(-1) || `Fioreze-ERP-Setup-${version}.exe`;
  if (!RELEASE_FILE_PATTERN.test(filename) || !filename.endsWith(".exe")) return null;

  return {
    version,
    filename,
    blockmap: `${filename}.blockmap`,
  };
}

async function serveRelease({ env, filename, head, prefix, pattern, manifest }) {
  if (!pattern.test(filename) || !env?.MEDIA_BUCKET) {
    return releaseNotFound();
  }

  const objectKey = `${prefix}${filename}`;
  const object = head
    ? await env.MEDIA_BUCKET.head(objectKey)
    : await env.MEDIA_BUCKET.get(objectKey);
  if (!object || (!head && !object.body)) return releaseNotFound();

  const headers = new Headers({
    "content-type": contentTypeFor(filename),
    "cache-control": filename === manifest
      ? "no-store"
      : "public, max-age=31536000, immutable",
    "x-content-type-options": "nosniff",
    "content-disposition": `attachment; filename="${filename}"`,
  });
  if (object.size != null) headers.set("content-length", String(object.size));
  const etag = object.httpEtag || object.etag;
  if (etag) headers.set("etag", etag);
  return new Response(head ? null : object.body, { status: 200, headers });
}

function renderDesktopDownloadCenter({ release, installerSize, hasBlockmap }) {
  const version = escapeHtml(release.version);
  const filename = escapeHtml(release.filename);
  const encodedFilename = encodeURIComponent(release.filename);
  const encodedBlockmap = encodeURIComponent(release.blockmap);
  const size = installerSize == null ? "" : ` · ${escapeHtml(formatBytes(installerSize))}`;
  const blockmapLink = hasBlockmap
    ? `<a href="/downloads/erp/${encodedBlockmap}">${escapeHtml(release.blockmap)}</a>`
    : "";

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Fioreze ERP · Downloads</title>
  <style>
    :root{font-family:Inter,"Segoe UI",Arial,sans-serif;color:#1d232b;background:#f7f8fa;color-scheme:light}
    *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:32px;background:linear-gradient(180deg,#f7f8fa 0%,#eef1f4 100%)}
    main{width:min(620px,100%);background:#fff;border:1px solid #e1e5e9;border-radius:24px;padding:34px;box-shadow:0 24px 70px rgba(20,27,34,.09)}
    .brand{display:flex;align-items:center;gap:12px;margin-bottom:28px}.mark{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:#1d232b;color:#fff;font-weight:800}.brand b{font-size:16px}.brand span{display:block;color:#87909d;font-size:12px;margin-top:2px}
    .badge{display:inline-flex;align-items:center;border:1px solid #d7dde3;background:#f7f8fa;border-radius:999px;padding:6px 10px;color:#586270;font-size:12px;font-weight:700}
    h1{font-size:30px;line-height:1.1;margin:16px 0 10px;letter-spacing:-.03em}p{color:#67717e;line-height:1.55;margin:0 0 24px}.download{display:flex;align-items:center;justify-content:center;width:100%;min-height:52px;border-radius:13px;background:#1d232b;color:#fff;text-decoration:none;font-weight:750;font-size:14px}.download:hover{background:#343c46}
    .meta{margin-top:12px;text-align:center;color:#87909d;font-size:12px}.advanced{margin-top:28px;padding-top:22px;border-top:1px solid #e7eaee}.advanced strong{display:block;font-size:12px;margin-bottom:10px;color:#586270}.links{display:flex;flex-direction:column;gap:8px}.links a{color:#586270;font-size:12px;text-decoration:none;overflow-wrap:anywhere}.links a:hover{text-decoration:underline}.note{margin-top:22px;padding:13px 14px;background:#f5f6f7;border-radius:12px;color:#67717e;font-size:12px;line-height:1.45}
  </style>
</head>
<body>
  <main>
    <div class="brand"><div class="mark">F</div><div><b>Fioreze ERP</b><span>Central de downloads</span></div></div>
    <span class="badge">Versao ${version}</span>
    <h1>Instalador para Windows</h1>
    <p>Baixe a versão mais recente do Fioreze ERP. Este endereço acompanha automaticamente o release publicado para o atualizador do aplicativo.</p>
    <a class="download" href="/downloads/erp/installer">Baixar Fioreze ERP</a>
    <div class="meta">${filename}${size}</div>
    <div class="advanced">
      <strong>Arquivos do release</strong>
      <div class="links">
        <a href="/downloads/erp/${encodedFilename}">${filename}</a>
        <a href="/downloads/erp/latest.yml">latest.yml</a>
        ${blockmapLink}
      </div>
    </div>
    <div class="note">O instalador usa o mesmo canal de atualização automática do aplicativo. Quando uma nova versão for publicada, este link continuará apontando para a versão atual.</div>
  </main>
</body>
</html>`;
}

function downloadCenterUnavailable({ head = false } = {}) {
  const body = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Fioreze ERP · Downloads</title></head><body style="font-family:Inter,Segoe UI,Arial,sans-serif;background:#f7f8fa;color:#1d232b;padding:48px"><main style="max-width:620px;margin:auto;background:#fff;border:1px solid #e1e5e9;border-radius:20px;padding:32px"><h1 style="margin-top:0">Fioreze ERP</h1><p>O instalador mais recente não está disponível neste momento.</p></main></body></html>`;
  return new Response(head ? null : body, {
    status: 503,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow",
    },
  });
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

function contentTypeFor(filename) {
  if (filename === "latest.yml") return "application/yaml; charset=utf-8";
  if (filename === "latest.json") return "application/json; charset=utf-8";
  if (filename.endsWith(".blockmap")) return "application/octet-stream";
  return "application/vnd.microsoft.portable-executable";
}

function releaseNotFound() {
  return new Response(JSON.stringify({ error: { code: "not_found", message: "Arquivo nao encontrado." } }), {
    status: 404,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export {
  PRINT_AGENT_RELEASE_FILE_PATTERN,
  PRINT_AGENT_RELEASE_PREFIX,
  RELEASE_FILE_PATTERN,
  RELEASE_PREFIX,
};
