export function withSecurityHeaders(response, options = {}) {
  const headers = new Headers(response.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  if (options.embed) {
    headers.delete("x-frame-options");
    if (!headers.has("content-security-policy")) {
      headers.set("content-security-policy", options.contentSecurityPolicy || embedContentSecurityPolicy(["'self'"]));
    }
  } else {
    headers.set("x-frame-options", "DENY");
    if (!headers.has("content-security-policy")) {
      headers.set("content-security-policy", `frame-ancestors ${options.admin ? "'none'" : "'self'"}; object-src 'none'; base-uri 'self'`);
    }
  }
  if (!headers.has("cache-control")) {
    headers.set("cache-control", "no-store");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function embedContentSecurityPolicy(frameAncestors) {
  const ancestors = frameAncestors.length ? frameAncestors.join(" ") : "'self'";
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self'",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    `frame-ancestors ${ancestors}`,
  ].join("; ");
}
