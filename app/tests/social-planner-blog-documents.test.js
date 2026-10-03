import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { removePostDocument, servePostDocument, uploadPostDocument } from "../src/modules/social-planner/marketing-repository.js";
import { MockR2Bucket } from "./helpers/mock-d1.js";

const migration = fs.readFileSync("migrations/0064_social_planner_blog_documents.sql", "utf8");
const backend = fs.readFileSync("src/modules/social-planner/marketing-repository.js", "utf8");
const routes = fs.readFileSync("src/modules/social-planner/routes.js", "utf8");
const app = fs.readFileSync("social-planner/app.ts", "utf8");
const blog = fs.readFileSync("social-planner/blog.ts", "utf8");
const styles = fs.readFileSync("public/css/modules/social-planner/planner.css", "utf8");

test("Blog simplifica o fluxo para pauta e um artigo privado", () => {
  for (const column of ["article_file_name", "article_mime_type", "article_size_bytes", "article_object_key", "article_uploaded_at"]) {
    assert.match(migration, new RegExp(`ADD COLUMN ${column}`));
  }
  assert.match(app, /\["blog-ideas", "Artigos", "file"\]/);
  assert.doesNotMatch(app, /\["blog-schedule", "Blog"/);
  assert.doesNotMatch(blog, />SEO</);
  assert.doesNotMatch(blog, /name="slug"/);
  assert.match(blog, /accept="\.pdf,\.docx,/);
  assert.match(blog, /Orientações do artigo/);
  assert.match(styles, /\.article-file-picker/);
});

test("Arquivos de artigo usam R2 autenticado com validacao de formato", () => {
  assert.match(routes, /blog-posts\/:id\/document/);
  assert.match(routes, /getCurrentSocialPlannerSession/);
  assert.match(routes, /assertAdminMutationAllowed/);
  assert.match(backend, /maxArticleBytes = 15 \* 1024 \* 1024/);
  assert.match(backend, /application\/pdf/);
  assert.match(backend, /wordprocessingml\.document/);
  assert.match(backend, /format\.signature\.every/);
  assert.match(backend, /cache-control": "private, no-store"/);
  assert.match(backend, /x-content-type-options": "nosniff"/);
  assert.match(backend, /delete row\.article_object_key/);
  assert.match(backend, /social-planner\/blog\/\$\{id\}/);
});

test("upload, download e remocao do artigo preservam somente metadados seguros", async () => {
  const row = {
    id: "blog-1", title: "Pauta do Centro", slug: "pauta-do-centro", status: "briefing",
    article_file_name: null, article_mime_type: null, article_size_bytes: null,
    article_object_key: null, article_uploaded_at: null, updated_at: "2026-10-03T12:00:00.000Z",
  };
  const env = { DB: fakeBlogDb(row), MEDIA_BUCKET: new MockR2Bucket() };
  const form = new FormData();
  form.set("file", new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37])], "artigo-centro.pdf", { type: "application/pdf" }));
  const uploaded = await uploadPostDocument(env, row.id, new Request("https://local.test/upload", { method: "POST", body: form }));
  assert.equal(uploaded.article_file_name, "artigo-centro.pdf");
  assert.equal(uploaded.status, "ready");
  assert.equal(Object.hasOwn(uploaded, "article_object_key"), false);
  assert.match(uploaded.article_download_url, /blog-1\/document$/);
  assert.equal(env.MEDIA_BUCKET.objects.size, 1);

  const response = await servePostDocument(env, row.id);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(response.headers.get("content-disposition"), /artigo-centro\.pdf/);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]));

  const removed = await removePostDocument(env, row.id);
  assert.equal(removed.article_file_name, null);
  assert.equal(removed.status, "briefing");
  assert.equal(env.MEDIA_BUCKET.objects.size, 0);
});

function fakeBlogDb(row) {
  return {
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async first() {
              if (sql.includes("WHERE slug = ?")) return null;
              if (sql.includes("WHERE p.id = ?")) return { ...row, author_user_id: null, hotel_name: null, author_name: null };
              if (sql.includes("WHERE id = ?")) return { ...row };
              return null;
            },
            async all() { return { results: [] }; },
            async run() {
              if (sql.includes("SET article_file_name = ?")) {
                [row.article_file_name, row.article_mime_type, row.article_size_bytes, row.article_object_key, row.article_uploaded_at, row.status, row.updated_at] = params;
              } else if (sql.includes("SET article_file_name = NULL")) {
                row.article_file_name = null; row.article_mime_type = null; row.article_size_bytes = null;
                row.article_object_key = null; row.article_uploaded_at = null; [row.status, row.updated_at] = params;
              }
              return { meta: { changes: 1 } };
            },
          };
        },
      };
    },
  };
}
