import assert from "node:assert/strict";
import test from "node:test";
import { ADMIN_ORIGIN, AURORA_USER_ID, createSessionCookie, withCookie } from "./helpers/admin-session.js";
import { createWorkerTestContext } from "./helpers/worker.js";

const MEDIA_PERMISSIONS = [
  "portals.media.read",
  "portals.media.upload",
  "portals.media.update",
  "portals.media.archive",
];

test("upload JPEG grava R2, metadados D1 e auditoria sem expor object_key", async () => {
  const { json, env } = createWorkerTestContext();
  grantMediaPermissions(env);
  const cookie = await createSessionCookie(env);

  const upload = await uploadImage(json, cookie, {
    file: imageFile(jpegBytes(), "foto-teste.jpg", "image/jpeg"),
    alt_text: "Imagem ficticia do quarto",
  });

  assert.equal(upload.response.status, 200);
  assert.equal(upload.body.data.asset.hotel_id, "muller-fioreze");
  assert.equal(upload.body.data.asset.module_key, "room-service");
  assert.equal(upload.body.data.asset.mime_type, "image/jpeg");
  assert.equal(upload.body.data.asset.size_bytes, jpegBytes().length);
  assert.match(upload.body.data.asset.public_url, /^\/media\/media_/);
  assert.equal(Object.hasOwn(upload.body.data.asset, "object_key"), false);
  assert.equal(env.MEDIA_BUCKET.objects.size, 1);
  assert.equal(env.__data.mediaAssets.filter((asset) => asset.storage_provider === "r2").length, 1);
  assert.equal(env.__data.adminAuditLog[0].action, "media.upload");
});

test("upload PNG e WebP valida magic bytes e checksum", async () => {
  const { json, env } = createWorkerTestContext();
  grantMediaPermissions(env);
  const cookie = await createSessionCookie(env);

  const png = await uploadImage(json, cookie, {
    file: imageFile(pngBytes(), "cardapio.png", "image/png"),
    alt_text: "PNG demo",
  });
  const webp = await uploadImage(json, cookie, {
    file: imageFile(webpBytes(), "cardapio.webp", "image/webp"),
    alt_text: "WebP demo",
  });

  assert.equal(png.response.status, 200);
  assert.equal(webp.response.status, 200);
  assert.equal(env.__data.mediaAssets.at(-2).checksum_sha256.length, 64);
  assert.equal(env.__data.mediaAssets.at(-1).checksum_sha256.length, 64);
});

test("upload MP4 e WebM valida assinatura, grava R2 e serve video", async () => {
  const { json, fetch, env } = createWorkerTestContext();
  grantMediaPermissions(env);
  const cookie = await createSessionCookie(env);

  const mp4 = await uploadImage(json, cookie, {
    file: imageFile(mp4Bytes(), "apresentacao.mp4", "video/mp4"),
    alt_text: "Video ficticio de apresentacao",
  });
  const webm = await uploadImage(json, cookie, {
    file: imageFile(webmBytes(), "evento.webm", "video/webm"),
    alt_text: "Video ficticio de evento",
  });
  const publicVideo = await fetch(mp4.body.data.asset.public_url);

  assert.equal(mp4.response.status, 200);
  assert.equal(webm.response.status, 200);
  assert.equal(mp4.body.data.asset.mime_type, "video/mp4");
  assert.equal(webm.body.data.asset.mime_type, "video/webm");
  assert.match(publicVideo.headers.get("content-type") || "", /video\/mp4/);
  assert.match([...env.MEDIA_BUCKET.objects.keys()].join("\n"), /\.mp4|\.webm/);
});

test("upload de video rejeita assinatura ou extensao divergente", async () => {
  const { json, env } = createWorkerTestContext();
  grantMediaPermissions(env);
  const cookie = await createSessionCookie(env);

  const badSignature = await uploadImage(json, cookie, {
    file: imageFile(new Uint8Array([1, 2, 3, 4]), "video.mp4", "video/mp4"),
  });
  const badExtension = await uploadImage(json, cookie, {
    file: imageFile(mp4Bytes(), "video.webm", "video/mp4"),
  });

  assert.equal(badSignature.response.status, 400);
  assert.equal(badExtension.response.status, 400);
  assert.equal(env.MEDIA_BUCKET.objects.size, 0);
});

test("listagem informa consumo total do armazenamento da unidade", async () => {
  const { json, env } = createWorkerTestContext();
  grantMediaPermissions(env);
  const cookie = await createSessionCookie(env);
  await uploadImage(json, cookie, { file: imageFile(jpegBytes(), "foto.jpg", "image/jpeg") });
  await uploadImage(json, cookie, { file: imageFile(mp4Bytes(), "video.mp4", "video/mp4") });

  const list = await json("/api/v1/admin/media?hotel_id=muller-fioreze&folder_id=root", withCookie(cookie));

  assert.equal(list.response.status, 200);
  assert.equal(list.body.data.storage.file_count, 2);
  assert.equal(list.body.data.storage.used_bytes, jpegBytes().length + mp4Bytes().length);
  assert.ok(list.body.data.storage.quota_bytes > list.body.data.storage.used_bytes);
  assert.ok(list.body.data.storage.percent_used >= 0);
});

test("upload rejeita MIME falso, magic bytes invalidos, SVG, arquivo vazio e arquivo acima de 8MB", async () => {
  const { json, env } = createWorkerTestContext();
  grantMediaPermissions(env);
  const cookie = await createSessionCookie(env);

  const cases = [
    imageFile(jpegBytes(), "fake.jpg", "image/png"),
    imageFile(new Uint8Array([1, 2, 3, 4]), "bad.jpg", "image/jpeg"),
    imageFile(new TextEncoder().encode("<svg></svg>"), "icon.svg", "image/svg+xml"),
    imageFile(new Uint8Array(), "empty.jpg", "image/jpeg"),
    imageFile(largeJpegBytes(), "large.jpg", "image/jpeg"),
  ];

  for (const file of cases) {
    const { response, body } = await uploadImage(json, cookie, { file });
    assert.ok([400, 413].includes(response.status));
    assert.equal(body.error.code, "bad_request");
  }
  assert.equal(env.MEDIA_BUCKET.objects.size, 0);
});

test("upload rejeita hotel sem acesso e usuario sem permissao", async () => {
  const withoutPermission = createWorkerTestContext();
  const cookieWithoutPermission = await createSessionCookie(withoutPermission.env);
  const deniedByPermission = await uploadImage(withoutPermission.json, cookieWithoutPermission, {
    file: imageFile(jpegBytes(), "foto.jpg", "image/jpeg"),
  });

  const { json, env } = createWorkerTestContext();
  grantMediaPermissions(env);
  const cookie = await createSessionCookie(env);
  const deniedByHotel = await uploadImage(json, cookie, {
    hotel_id: "aurora-demo",
    file: imageFile(jpegBytes(), "foto.jpg", "image/jpeg"),
  });

  assert.equal(deniedByPermission.response.status, 401);
  assert.equal(deniedByHotel.response.status, 401);
});

test("object_key e gerado pelo servidor e ignora nome malicioso", async () => {
  const { json, env } = createWorkerTestContext();
  grantMediaPermissions(env);
  const cookie = await createSessionCookie(env);

  const upload = await uploadImage(json, cookie, {
    file: imageFile(jpegBytes(), "../pastas/segredo.jpg", "image/jpeg"),
  });
  const object = [...env.MEDIA_BUCKET.objects.values()][0];

  assert.equal(upload.response.status, 200);
  assert.match(object.key, /^hotels\/muller-fioreze\/room-service\/2026\/07\/media_.*\.jpg$/);
  assert.doesNotMatch(object.key, /\.\.|segredo|pastas/);
  assert.equal(env.__data.mediaAssets.at(-1).original_filename, "segredo.jpg");
});

test("falha no D1 apos put remove objeto R2 e retorna erro seguro", async () => {
  const { json, env } = createWorkerTestContext();
  grantMediaPermissions(env);
  const cookie = await createSessionCookie(env);
  env.DB.failNextMediaAssetInsert = true;

  const upload = await uploadImage(json, cookie, {
    file: imageFile(jpegBytes(), "foto.jpg", "image/jpeg"),
  });

  assert.equal(upload.response.status, 500);
  assert.equal(upload.body.error.code, "media_metadata_failed");
  assert.equal(env.MEDIA_BUCKET.objects.size, 0);
  assert.equal(env.__data.mediaAssets.filter((asset) => asset.storage_provider === "r2").length, 0);
});

test("listagem de midias respeita hotel, filtros e busca", async () => {
  const { json, env } = createWorkerTestContext();
  grantMediaPermissions(env);
  const cookie = await createSessionCookie(env);
  await uploadImage(json, cookie, {
    file: imageFile(jpegBytes(), "suite-demo.jpg", "image/jpeg"),
    alt_text: "Suite demo",
  });

  const list = await json("/api/v1/admin/media?hotel_id=muller-fioreze&module_key=room-service&q=suite", withCookie(cookie));

  assert.equal(list.response.status, 200);
  assert.equal(list.body.data.assets.length, 1);
  assert.equal(list.body.data.assets[0].hotel_id, "muller-fioreze");
});

test("detalhe de outro hotel retorna 404 mesmo com ID conhecido", async () => {
  const { json, env } = createWorkerTestContext();
  grantMediaPermissions(env);
  const mullerCookie = await createSessionCookie(env);
  const upload = await uploadImage(json, mullerCookie, {
    file: imageFile(jpegBytes(), "foto.jpg", "image/jpeg"),
  });
  const auroraCookie = await createSessionCookie(env, AURORA_USER_ID);

  const detail = await json(`/api/v1/admin/media/${upload.body.data.asset.id}`, withCookie(auroraCookie));

  assert.equal(detail.response.status, 404);
  assert.equal(detail.body.error.code, "not_found");
});

test("atualizacao altera somente alt_text e module_key permitidos", async () => {
  const { json, env } = createWorkerTestContext();
  grantMediaPermissions(env);
  const cookie = await createSessionCookie(env);
  const upload = await uploadImage(json, cookie, {
    file: imageFile(jpegBytes(), "foto.jpg", "image/jpeg"),
  });

  const updated = await json(
    `/api/v1/admin/media/${upload.body.data.asset.id}`,
    withCookie(cookie, adminJson("PATCH", { alt_text: "Novo texto alternativo", module_key: "guest-portal" })),
  );
  const rejected = await json(
    `/api/v1/admin/media/${upload.body.data.asset.id}`,
    withCookie(cookie, adminJson("PATCH", { object_key: "manual" })),
  );

  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.data.asset.alt_text, "Novo texto alternativo");
  assert.equal(updated.body.data.asset.module_key, "guest-portal");
  assert.equal(rejected.response.status, 400);
  assert.equal(env.__data.adminAuditLog.at(-1).action, "media.update");
});

test("biblioteca cria, navega e renomeia pastas com trilha de navegacao", async () => {
  const { json, env } = createWorkerTestContext();
  grantMediaPermissions(env);
  const cookie = await createSessionCookie(env);

  const root = await createFolder(json, cookie, { name: "Cardapio", hotel_id: "muller-fioreze" });
  const child = await createFolder(json, cookie, {
    name: "Pratos principais",
    hotel_id: "muller-fioreze",
    parent_id: root.body.data.folder.id,
  });
  const rootList = await json("/api/v1/admin/media-folders?hotel_id=muller-fioreze", withCookie(cookie));
  const childList = await json(
    `/api/v1/admin/media-folders?hotel_id=muller-fioreze&parent_id=${encodeURIComponent(root.body.data.folder.id)}`,
    withCookie(cookie),
  );
  const renamed = await json(
    `/api/v1/admin/media-folders/${encodeURIComponent(child.body.data.folder.id)}`,
    withCookie(cookie, adminJson("PATCH", { name: "Pratos" })),
  );

  assert.equal(root.response.status, 201);
  assert.equal(child.response.status, 201);
  assert.deepEqual(rootList.body.data.folders.map((folder) => folder.name), ["Cardapio"]);
  assert.deepEqual(childList.body.data.breadcrumbs.map((folder) => folder.name), ["Cardapio"]);
  assert.deepEqual(childList.body.data.folders.map((folder) => folder.name), ["Pratos principais"]);
  assert.equal(renamed.body.data.folder.name, "Pratos");
  assert.equal(env.__data.adminAuditLog.filter((entry) => entry.entity_type === "media_folder").length, 3);
});

test("pastas rejeitam nomes duplicados e preservam isolamento entre unidades", async () => {
  const { json, env } = createWorkerTestContext();
  grantMediaPermissions(env);
  const mullerCookie = await createSessionCookie(env);
  const auroraCookie = await createSessionCookie(env, AURORA_USER_ID);
  const created = await createFolder(json, mullerCookie, { name: "Campanhas", hotel_id: "muller-fioreze" });
  const duplicate = await createFolder(json, mullerCookie, { name: "campanhas", hotel_id: "muller-fioreze" });
  const isolated = await json(
    `/api/v1/admin/media-folders?hotel_id=aurora-demo&parent_id=${encodeURIComponent(created.body.data.folder.id)}`,
    withCookie(auroraCookie),
  );

  assert.equal(created.response.status, 201);
  assert.equal(duplicate.response.status, 409);
  assert.equal(duplicate.body.error.code, "folder_name_conflict");
  assert.equal(isolated.response.status, 400);
  assert.equal(isolated.body.error.code, "bad_request");
});

test("pastas podem ser reorganizadas por arrastar sem permitir ciclos", async () => {
  const { json, env } = createWorkerTestContext();
  grantMediaPermissions(env);
  const cookie = await createSessionCookie(env);
  const menu = await createFolder(json, cookie, { name: "Menu", hotel_id: "muller-fioreze" });
  const photos = await createFolder(json, cookie, { name: "Fotos", hotel_id: "muller-fioreze" });
  const dishes = await createFolder(json, cookie, {
    name: "Pratos",
    hotel_id: "muller-fioreze",
    parent_id: menu.body.data.folder.id,
  });

  const moved = await json(
    `/api/v1/admin/media-folders/${encodeURIComponent(photos.body.data.folder.id)}`,
    withCookie(cookie, adminJson("PATCH", { parent_id: menu.body.data.folder.id })),
  );
  const cycle = await json(
    `/api/v1/admin/media-folders/${encodeURIComponent(menu.body.data.folder.id)}`,
    withCookie(cookie, adminJson("PATCH", { parent_id: dishes.body.data.folder.id })),
  );
  const nested = await json(
    `/api/v1/admin/media-folders?hotel_id=muller-fioreze&parent_id=${encodeURIComponent(menu.body.data.folder.id)}`,
    withCookie(cookie),
  );

  assert.equal(moved.response.status, 200);
  assert.deepEqual(moved.body.data.changed_fields, ["parent_id"]);
  assert.equal(moved.body.data.folder.parent_id, menu.body.data.folder.id);
  assert.equal(cycle.response.status, 400);
  assert.deepEqual(nested.body.data.folders.map((folder) => folder.name), ["Fotos", "Pratos"]);
  assert.equal(env.__data.adminAuditLog.at(-1).action, "media-folder.move");
});

test("arrastar imagem entre pastas altera somente organizacao e mantem URL e objeto", async () => {
  const { json, env } = createWorkerTestContext();
  grantMediaPermissions(env);
  const cookie = await createSessionCookie(env);
  const folder = await createFolder(json, cookie, { name: "Restaurante", hotel_id: "muller-fioreze" });
  const upload = await uploadImage(json, cookie, {
    file: imageFile(jpegBytes(), "prato.jpg", "image/jpeg"),
  });
  const storedBefore = { ...env.__data.mediaAssets.find((entry) => entry.id === upload.body.data.asset.id) };

  const moved = await json(
    `/api/v1/admin/media/${encodeURIComponent(upload.body.data.asset.id)}`,
    withCookie(cookie, adminJson("PATCH", { folder_id: folder.body.data.folder.id })),
  );
  const rootList = await json("/api/v1/admin/media?hotel_id=muller-fioreze&folder_id=root", withCookie(cookie));
  const folderList = await json(
    `/api/v1/admin/media?hotel_id=muller-fioreze&folder_id=${encodeURIComponent(folder.body.data.folder.id)}`,
    withCookie(cookie),
  );
  const storedAfter = env.__data.mediaAssets.find((entry) => entry.id === upload.body.data.asset.id);

  assert.equal(moved.response.status, 200);
  assert.equal(moved.body.data.asset.folder_id, folder.body.data.folder.id);
  assert.equal(rootList.body.data.assets.some((entry) => entry.id === upload.body.data.asset.id), false);
  assert.equal(folderList.body.data.assets.some((entry) => entry.id === upload.body.data.asset.id), true);
  assert.equal(storedAfter.object_key, storedBefore.object_key);
  assert.equal(storedAfter.public_url, storedBefore.public_url);
  assert.equal(env.MEDIA_BUCKET.objects.size, 1);
});

test("pasta com conteudo nao pode ser arquivada e pasta vazia pode", async () => {
  const { json, env } = createWorkerTestContext();
  grantMediaPermissions(env);
  const cookie = await createSessionCookie(env);
  const folder = await createFolder(json, cookie, { name: "Eventos", hotel_id: "muller-fioreze" });
  await uploadImage(json, cookie, {
    folder_id: folder.body.data.folder.id,
    file: imageFile(jpegBytes(), "evento.jpg", "image/jpeg"),
  });
  const blocked = await json(
    `/api/v1/admin/media-folders/${encodeURIComponent(folder.body.data.folder.id)}`,
    withCookie(cookie, adminJson("DELETE", {})),
  );
  const empty = await createFolder(json, cookie, { name: "Vazia", hotel_id: "muller-fioreze" });
  const archived = await json(
    `/api/v1/admin/media-folders/${encodeURIComponent(empty.body.data.folder.id)}`,
    withCookie(cookie, adminJson("DELETE", {})),
  );

  assert.equal(blocked.response.status, 409);
  assert.equal(blocked.body.error.code, "folder_not_empty");
  assert.equal(archived.response.status, 200);
  assert.equal(archived.body.data.archived, true);
});

test("arquivar e logico, nao deleta objeto R2 e bloqueia publicacao", async () => {
  const { json, fetch, env } = createWorkerTestContext();
  grantMediaPermissions(env);
  const cookie = await createSessionCookie(env);
  const upload = await uploadImage(json, cookie, {
    file: imageFile(jpegBytes(), "foto.jpg", "image/jpeg"),
  });

  const archived = await json(
    `/api/v1/admin/media/${upload.body.data.asset.id}`,
    withCookie(cookie, adminJson("DELETE", {})),
  );
  const publicResponse = await fetch(upload.body.data.asset.public_url);

  assert.equal(archived.response.status, 200);
  assert.equal(archived.body.data.asset.status, "archived");
  assert.equal(env.MEDIA_BUCKET.objects.size, 1);
  assert.equal(publicResponse.status, 404);
  assert.equal(env.__data.adminAuditLog.at(-1).action, "media.archive");
});

test("rota publica /media/:id transmite imagem ativa com headers seguros", async () => {
  const { json, fetch, env } = createWorkerTestContext();
  grantMediaPermissions(env);
  const cookie = await createSessionCookie(env);
  const upload = await uploadImage(json, cookie, {
    file: imageFile(pngBytes(), "foto.png", "image/png"),
  });

  const response = await fetch(upload.body.data.asset.public_url);
  const body = new Uint8Array(await response.arrayBuffer());

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /image\/png/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(response.headers.get("cache-control") || "", /max-age=3600/);
  assert.ok(response.headers.get("etag"));
  assert.equal(body.length, pngBytes().length);
});

test("HEAD /media/:id retorna metadados sem corpo", async () => {
  const { json, fetch, env } = createWorkerTestContext();
  grantMediaPermissions(env);
  const cookie = await createSessionCookie(env);
  const upload = await uploadImage(json, cookie, {
    file: imageFile(webpBytes(), "foto.webp", "image/webp"),
  });

  const response = await fetch(upload.body.data.asset.public_url, { method: "HEAD" });

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /image\/webp/);
  assert.equal((await response.text()).length, 0);
  assert.equal(env.MEDIA_BUCKET.headCalls, 1);
  assert.equal(env.MEDIA_BUCKET.getCalls, 0);
});

test("objeto sem metadado D1 e binding ausente falham de forma segura", async () => {
  const missingMetadata = createWorkerTestContext();
  await missingMetadata.env.MEDIA_BUCKET.put("hotels/muller-fioreze/shared/2026/07/manual.jpg", jpegBytes(), {
    httpMetadata: { contentType: "image/jpeg" },
  });

  const noMetadata = await missingMetadata.fetch("/media/media-inexistente");
  const missingBinding = createWorkerTestContext({ MEDIA_BUCKET: undefined });
  const noBinding = await missingBinding.fetch("/media/media-inexistente");

  assert.equal(noMetadata.status, 404);
  assert.equal(noBinding.status, 503);
});

test("midia inexistente passa pelo Worker e nao pelo fallback HTML", async () => {
  const { fetch } = createWorkerTestContext();

  const response = await fetch("/media/media-inexistente", { redirect: "manual" });
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.match(response.headers.get("content-type") || "", /application\/json/);
  assert.doesNotMatch(response.headers.get("content-type") || "", /text\/html/);
  assert.equal(body.error.code, "not_found");
});

test("rotas canonicas da biblioteca de imagens carregam shell da Central", async () => {
  const { fetch } = createWorkerTestContext();
  const redirect = await fetch("/admin/portais/media", { redirect: "manual" });
  const shell = await fetch("/admin/portais/media/", { redirect: "manual" });
  const nested = await fetch("/admin/portais/media/asset", { redirect: "manual" });

  assert.equal(redirect.status, 308);
  assert.equal(new URL(redirect.headers.get("location")).pathname, "/admin/portais/media/");
  assert.equal(shell.status, 200);
  assert.equal(nested.status, 200);
  assert.match(await shell.text(), /mediaLibrary/);
});

test("sessao administrativa e Room Service continuam sem regressao", async () => {
  const context = createWorkerTestContext();
  const cookie = await createSessionCookie(context.env);
  const session = await context.json("/api/v1/admin/session", withCookie(cookie));
  const products = await context.json("/api/v1/public/hotels/muller-fioreze/room-service/products");

  assert.equal(session.response.status, 200);
  assert.equal(products.response.status, 200);
  assert.ok(products.body.data.categories.length > 0);
});

function uploadImage(json, cookie, { hotel_id = "muller-fioreze", module_key = "room-service", folder_id = "", alt_text = "Imagem demo", file }) {
  const form = new FormData();
  form.set("hotel_id", hotel_id);
  form.set("module_key", module_key);
  form.set("folder_id", folder_id);
  form.set("alt_text", alt_text);
  form.set("file", file);
  return json("/api/v1/admin/media", {
    method: "POST",
    headers: {
      origin: ADMIN_ORIGIN,
      "x-fioreze-admin-action": "erp-admin",
      "x-fioreze-test-now": "2026-07-07T12:34:56.000Z",
      cookie,
    },
    body: form,
  });
}

function createFolder(json, cookie, body) {
  return json("/api/v1/admin/media-folders", withCookie(cookie, adminJson("POST", body)));
}

function adminJson(method, body) {
  return {
    method,
    headers: {
      "content-type": "application/json",
      origin: ADMIN_ORIGIN,
      "x-fioreze-admin-action": "erp-admin",
    },
    body: JSON.stringify(body),
  };
}

function grantMediaPermissions(env, permissions = MEDIA_PERMISSIONS) {
  for (const permissionKey of permissions) {
    const permission = env.__data.adminPermissions.find((entry) => entry.permission_key === permissionKey);
    if (!permission) continue;
    const exists = env.__data.adminRolePermissions.some(
      (entry) => entry.role_id === "role-demo-manager" && entry.permission_id === permission.id,
    );
    if (!exists) {
      env.__data.adminRolePermissions.push({ role_id: "role-demo-manager", permission_id: permission.id });
    }
  }
}

function imageFile(bytes, name, type) {
  return new File([bytes], name, { type });
}

function jpegBytes() {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x01, 0x02, 0xff, 0xd9]);
}

function pngBytes() {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
}

function webpBytes() {
  return new Uint8Array([
    0x52,
    0x49,
    0x46,
    0x46,
    0x08,
    0x00,
    0x00,
    0x00,
    0x57,
    0x45,
    0x42,
    0x50,
    0x56,
    0x50,
    0x38,
    0x20,
  ]);
}

function mp4Bytes() {
  return new Uint8Array([
    0x00, 0x00, 0x00, 0x18,
    0x66, 0x74, 0x79, 0x70,
    0x69, 0x73, 0x6f, 0x6d,
    0x00, 0x00, 0x00, 0x00,
    0x69, 0x73, 0x6f, 0x6d,
    0x6d, 0x70, 0x34, 0x32,
  ]);
}

function webmBytes() {
  return new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01]);
}

function largeJpegBytes() {
  const bytes = new Uint8Array(8 * 1024 * 1024 + 1);
  bytes.set([0xff, 0xd8, 0xff], 0);
  return bytes;
}
