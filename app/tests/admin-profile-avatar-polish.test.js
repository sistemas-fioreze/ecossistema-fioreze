import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createWorkerTestContext } from "./helpers/worker.js";
import { ADMIN_ORIGIN, createSessionCookie, withCookie } from "./helpers/admin-session.js";

const MUTATION_HEADERS = {
  "x-fioreze-admin-action": "erp-admin",
  origin: ADMIN_ORIGIN,
  "x-fioreze-test-now": "2026-07-12T12:00:00.000Z",
};

test("avatar aceita PNG, JPEG, WebP e AVIF validos sem criar media_assets", async () => {
  for (const [mimeType, bytes] of Object.entries(avatarFixtures())) {
    const { json, env } = createWorkerTestContext();
    const cookie = await createSessionCookie(env);
    const mediaCount = env.__data.mediaAssets.length;

    const upload = await json("/api/v1/admin/me/avatar", withCookie(cookie, multipartAvatar(mimeType, bytes)));

    assert.equal(upload.response.status, 200, mimeType);
    assert.equal(upload.body.data.avatar.mime_type, mimeType);
    assert.match(env.__data.adminUsers[0].avatar_object_key, /^admin-avatars\/user-demo-admin\/avatar_/);
    assert.equal(env.__data.mediaAssets.length, mediaCount);
    assert.equal(env.__data.adminAuditLog.at(-1).action, "admin-user.avatar-update");
  }
});

test("avatar rejeita MIME falso, formato invalido e arquivo grande", async () => {
  const { json, env } = createWorkerTestContext();
  const cookie = await createSessionCookie(env);
  const fake = await json("/api/v1/admin/me/avatar", withCookie(cookie, multipartAvatar("image/png", new Uint8Array([1, 2, 3]))));
  const text = await json("/api/v1/admin/me/avatar", withCookie(cookie, multipartAvatar("text/plain", new Uint8Array([1, 2, 3]))));
  const huge = await json(
    "/api/v1/admin/me/avatar",
    withCookie(cookie, multipartAvatar("image/png", new Uint8Array(3 * 1024 * 1024 + 1).fill(0x89))),
  );

  assert.equal(fake.response.status, 400);
  assert.equal(text.response.status, 400);
  assert.equal(huge.response.status, 400);
  assert.equal(env.MEDIA_BUCKET.objects.size, 0);
});

test("avatar privado exige sessao e retorna fallback seguro quando ausente", async () => {
  const { fetch, env } = createWorkerTestContext();
  const cookie = await createSessionCookie(env);

  const anonymous = await fetch("/api/v1/admin/me/avatar");
  const fallback = await fetch("/api/v1/admin/me/avatar", withCookie(cookie));
  const body = await fallback.text();

  assert.equal(anonymous.status, 401);
  assert.equal(fallback.status, 200);
  assert.match(fallback.headers.get("content-type") || "", /image\/svg\+xml/);
  assert.match(fallback.headers.get("cache-control") || "", /private/);
  assert.match(body, /svg/);
});

test("avatar de outro usuario exige permissao de leitura de usuarios", async () => {
  const { fetch, env } = createWorkerTestContext();
  env.__data.adminRolePermissions = env.__data.adminRolePermissions.filter(
    (entry) => !env.__data.adminPermissions.find((permission) => permission.id === entry.permission_id)?.permission_key.startsWith("admin.users."),
  );
  const cookie = await createSessionCookie(env);

  const response = await fetch("/api/v1/admin/users/user-aurora-admin/avatar", withCookie(cookie));

  assert.equal(response.status, 401);
});

test("upload, leitura HEAD e remocao de avatar usam R2 privado", async () => {
  const { fetch, json, env } = createWorkerTestContext();
  const cookie = await createSessionCookie(env);

  const upload = await json("/api/v1/admin/me/avatar", withCookie(cookie, multipartAvatar("image/png", avatarFixtures()["image/png"])));
  const objectKey = env.__data.adminUsers[0].avatar_object_key;
  const get = await fetch("/api/v1/admin/me/avatar", withCookie(cookie));
  const head = await fetch("/api/v1/admin/me/avatar", withCookie(cookie, { method: "HEAD" }));
  const remove = await json("/api/v1/admin/me/avatar", withCookie(cookie, { method: "DELETE", headers: MUTATION_HEADERS, body: "{}" }));

  assert.equal(upload.response.status, 200);
  assert.equal(get.status, 200);
  assert.match(get.headers.get("content-type") || "", /image\/png/);
  assert.equal(head.status, 200);
  assert.equal(head.headers.get("content-type"), "image/png");
  assert.equal(remove.response.status, 200);
  assert.equal(env.__data.adminUsers[0].avatar_object_key, null);
  assert.equal(env.MEDIA_BUCKET.objects.has(objectKey), false);
});

test("migration 0013 adiciona avatar administrativo sem media_assets", () => {
  const source = fs.readFileSync("migrations/0013_admin_profile_avatars.sql", "utf8");
  assert.match(source, /avatar_object_key/);
  assert.match(source, /avatar_mime_type/);
  assert.doesNotMatch(source, /media_assets/i);
});

function multipartAvatar(mimeType, bytes) {
  const form = new FormData();
  form.append("avatar", new Blob([bytes], { type: mimeType }), `avatar.${mimeType.split("/")[1] || "bin"}`);
  return {
    method: "POST",
    headers: MUTATION_HEADERS,
    body: form,
  };
}

function avatarFixtures() {
  return {
    "image/png": new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    "image/jpeg": new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
    "image/webp": new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x12, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]),
    "image/avif": new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66]),
  };
}
