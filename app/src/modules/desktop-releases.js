const RELEASE_PREFIX = "desktop/erp/releases/";
const RELEASE_FILE_PATTERN = /^(?:latest\.yml|Fioreze-ERP-Setup-\d+\.\d+\.\d+\.exe(?:\.blockmap)?)$/;

export async function serveDesktopRelease({ env, params, head = false }) {
  const filename = String(params.file || "");
  if (!RELEASE_FILE_PATTERN.test(filename) || !env?.MEDIA_BUCKET) {
    return releaseNotFound();
  }

  const objectKey = `${RELEASE_PREFIX}${filename}`;
  const object = head
    ? await env.MEDIA_BUCKET.head(objectKey)
    : await env.MEDIA_BUCKET.get(objectKey);
  if (!object || (!head && !object.body)) return releaseNotFound();

  const headers = new Headers({
    "content-type": contentTypeFor(filename),
    "cache-control": filename === "latest.yml"
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

export { RELEASE_FILE_PATTERN, RELEASE_PREFIX };
