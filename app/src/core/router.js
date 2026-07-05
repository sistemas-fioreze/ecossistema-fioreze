import { methodNotAllowed, notFound } from "./responses.js";

function trimPath(pathname) {
  return pathname.replace(/^\/+|\/+$/g, "");
}

function splitPath(pathname) {
  const trimmed = trimPath(pathname);
  return trimmed ? trimmed.split("/") : [];
}

function matchRoute(pattern, pathname) {
  const patternParts = splitPath(pattern);
  const pathParts = splitPath(pathname);
  const hasWildcard = patternParts.at(-1) === "*";
  if (!hasWildcard && patternParts.length !== pathParts.length) return null;
  if (hasWildcard && pathParts.length < patternParts.length - 1) return null;

  const params = {};
  for (let i = 0; i < patternParts.length; i += 1) {
    const expected = patternParts[i];
    if (expected === "*") {
      params.wildcard = pathParts.slice(i).map(decodeURIComponent).join("/");
      return params;
    }
    const actual = decodeURIComponent(pathParts[i] || "");
    if (expected.startsWith(":")) {
      params[expected.slice(1)] = actual;
      continue;
    }
    if (expected !== actual) return null;
  }
  return params;
}

export class Router {
  constructor() {
    this.routes = [];
  }

  add(method, pattern, handler) {
    this.routes.push({ method, pattern, handler });
  }

  get(pattern, handler) {
    this.add("GET", pattern, handler);
  }

  post(pattern, handler) {
    this.add("POST", pattern, handler);
  }

  all(pattern, handler) {
    this.add("*", pattern, handler);
  }

  async handle(request, env, ctx) {
    const url = new URL(request.url);
    const allowed = new Set();

    for (const route of this.routes) {
      const params = matchRoute(route.pattern, url.pathname);
      if (!params) continue;
      if (route.method !== "*" && route.method !== request.method) {
        allowed.add(route.method);
        continue;
      }
      return route.handler({ request, env, ctx, params, url });
    }

    if (allowed.size) return methodNotAllowed([...allowed].sort());
    return notFound("Rota de API nao encontrada.");
  }
}
