const textEncoder = new TextEncoder();

export async function hmacSha256Hex(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(value));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function configuredPrivacySecret(env, ...names) {
  for (const name of names) {
    const value = String(env?.[name] || "").trim();
    if (value.length >= 32) return value;
  }
  return "";
}

export function visitorRequestContext(request, env) {
  const testEnvironment = env.ENVIRONMENT === "test";
  const cloudflareIp = request.headers.get("cf-connecting-ip")?.trim();
  const forwardedIp = testEnvironment ? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() : "";
  const ip = cloudflareIp || forwardedIp || (testEnvironment ? "test-client" : "");
  const cf = request.cf || {};
  return {
    ip,
    countryCode: cleanLocationValue(cf.country || request.headers.get("cf-ipcountry"), 12),
    region: cleanLocationValue(cf.region || cf.regionCode || (testEnvironment ? request.headers.get("x-fioreze-test-region") : ""), 80),
  };
}

function cleanLocationValue(value, maxLength) {
  const clean = String(value || "").trim();
  if (!clean || clean.toLowerCase() === "xx") return null;
  return clean.slice(0, maxLength);
}
