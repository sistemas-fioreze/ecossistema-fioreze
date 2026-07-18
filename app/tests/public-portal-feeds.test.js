import assert from "node:assert/strict";
import test from "node:test";

import { buildBlogUrl, loadPublicBlog, loadPublicWeather } from "../src/services/public-portal-feeds.js";

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
        excerpt: { rendered: "<p>Conteudo <strong>ficticio</strong>.</p>" },
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
    excerpt: "Conteudo ficticio .",
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

test("clima usa coordenadas e fuso da unidade", async () => {
  let requestedUrl = "";
  const weather = await loadPublicWeather({
    latitude: "-29.37",
    longitude: "-50.88",
    timezone: "America/Sao_Paulo",
    fetchImpl: async (url) => {
      requestedUrl = String(url);
      return new Response(JSON.stringify({
        current: { temperature_2m: 17.6, apparent_temperature: 17.1, weather_code: 2, precipitation: 0, relative_humidity_2m: 81, time: "2026-07-17T12:00" },
        daily: { time: ["2026-07-17", "2026-07-18", "2026-07-19"], weather_code: [2, 61, 0], temperature_2m_max: [20.1, 18.4, 22], temperature_2m_min: [10.2, 9.6, 11], precipitation_probability_max: [10, 80, 0] },
      }), { headers: { "content-type": "application/json" } });
    },
  });

  const requested = new URL(requestedUrl);
  assert.equal(requested.searchParams.get("latitude"), "-29.37");
  assert.equal(requested.searchParams.get("longitude"), "-50.88");
  assert.equal(requested.searchParams.get("timezone"), "America/Sao_Paulo");
  assert.equal(weather.available, true);
  assert.equal(weather.current.temperature, 18);
  assert.equal(weather.current.description, "Parcialmente nublado");
  assert.equal(weather.forecast.length, 3);
});

test("clima sem coordenadas nao realiza chamada externa", async () => {
  let called = false;
  const weather = await loadPublicWeather({ latitude: "", longitude: null, fetchImpl: async () => { called = true; } });
  assert.equal(called, false);
  assert.deepEqual(weather, { available: false, current: null, forecast: [] });
});
