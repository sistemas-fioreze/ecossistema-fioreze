import assert from "node:assert/strict";
import test from "node:test";

import { buildBlogUrl, loadPublicBlog } from "../src/services/public-portal-feeds.js";

test("blog oficial e reduzido a conteudo publico sanitizado", async () => {
  let requestedUrl = "";
  const posts = await loadPublicBlog({
    feedUrl: "https://blog.hoteisfioreze.com.br/wp-json/wp/v2/posts?parametro=ignorado",
    fetchImpl: async (url) => {
      requestedUrl = String(url);
      return new Response(JSON.stringify([{
        id: 42,
        slug: "novidade-ficticia",
        link: "https://blog.hoteisfioreze.com.br/novidade-ficticia/",
        date: "2026-07-17T12:00:00-03:00",
        title: { rendered: "Novidade &amp; lazer" },
        excerpt: { rendered: "<p>Conteudo <strong>ficticio</strong>&#8230;</p>" },
        _embedded: { "wp:featuredmedia": [{ source_url: "https://blog.hoteisfioreze.com.br/media/ficticia.jpg" }] },
      }]), { headers: { "content-type": "application/json" } });
    },
  });

  const requested = new URL(requestedUrl);
  assert.equal(requested.hostname, "blog.hoteisfioreze.com.br");
  assert.equal(requested.searchParams.get("per_page"), "12");
  assert.equal(requested.searchParams.has("parametro"), false);
  assert.deepEqual(posts[0], {
    id: "42",
    slug: "novidade-ficticia",
    title: "Novidade & lazer",
    excerpt: "Conteudo ficticio …",
    published_at: "2026-07-17T15:00:00.000Z",
    link: "https://blog.hoteisfioreze.com.br/novidade-ficticia/",
    image_url: "https://blog.hoteisfioreze.com.br/media/ficticia.jpg",
  });
});

test("blog rejeita origem ou caminho nao autorizado", () => {
  assert.throws(() => buildBlogUrl("https://example.invalid/wp-json/wp/v2/posts"), /nao autorizado/);
  assert.throws(() => buildBlogUrl("https://blog.hoteisfioreze.com.br/wp-json/wp/v2/users"), /nao autorizado/);
  assert.throws(() => buildBlogUrl("https://blog.hoteisfioreze.com.br/wp-json/wp/v2/posts-private"), /nao autorizado/);
});

test("timeout do feed e limpo mesmo quando o cliente falha de forma sincrona", async () => {
  await assert.rejects(
    () => loadPublicBlog({ fetchImpl: () => { throw new Error("falha ficticia"); } }),
    /falha ficticia/,
  );
});
