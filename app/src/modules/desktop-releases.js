const RELEASE_PREFIX = "desktop/erp/releases/";
const RELEASE_FILE_PATTERN = /^(?:latest\.yml|Fioreze-ERP-Setup-\d+\.\d+\.\d+\.exe(?:\.blockmap)?)$/;
const PRINT_AGENT_RELEASE_PREFIX = "desktop/print-agent/releases/";
const PRINT_AGENT_RELEASE_FILE_PATTERN = /^(?:latest\.json|Fioreze-Suite-\d+\.\d+\.\d+\.exe)$/;

export async function serveDesktopRelease({ env, params, head = false }) {
  return serveRelease({
    env,
    filename: String(params.file || ""),
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
