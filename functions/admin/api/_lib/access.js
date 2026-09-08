const JWKS_TTL_MS = 60 * 60 * 1000;
let jwksCache = { at: 0, host: "", keys: [] };

function teamHost(value) {
  return String(value || "")
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

function b64UrlToBytes(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function parsePart(part) {
  return JSON.parse(new TextDecoder().decode(b64UrlToBytes(part)));
}

async function getJwks(host) {
  if (jwksCache.keys.length && jwksCache.host === host && Date.now() - jwksCache.at < JWKS_TTL_MS) {
    return jwksCache.keys;
  }
  const response = await fetch(`https://${host}/cdn-cgi/access/certs`);
  if (!response.ok) throw new Error("Could not load Cloudflare Access keys");
  const data = await response.json();
  const keys = Array.isArray(data.keys) ? data.keys : [];
  jwksCache = { at: Date.now(), host, keys };
  return keys;
}

function audienceOk(aud, expected) {
  if (!expected) return false;
  if (typeof aud === "string") return aud === expected;
  return Array.isArray(aud) && aud.includes(expected);
}

export async function assertAccess(request, env, options = {}) {
  const host = teamHost(env.CF_ACCESS_TEAM_DOMAIN);
  const audience = String(env.CF_ACCESS_AUD || "").trim();
  const token = request.headers.get("Cf-Access-Jwt-Assertion") || "";
  const headerEmail = (request.headers.get("Cf-Access-Authenticated-User-Email") || "").toLowerCase();
  const requireGithub = options.requireGithub !== false;

  if (requireGithub && !env.ADMIN_GITHUB_TOKEN && !env.GITHUB_TOKEN) {
    return { ok: false, error: "Writes are not configured. Set ADMIN_GITHUB_TOKEN on Pages." };
  }
  if (!host || !audience) {
    return { ok: false, error: "Set CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD on Pages, then retry the deploy." };
  }
  if (!token) {
    return { ok: false, error: "Missing Access token. Sign in with Google, then refresh." };
  }

  const [headerPart, payloadPart, signaturePart] = token.split(".");
  if (!headerPart || !payloadPart || !signaturePart) {
    return { ok: false, error: "Unauthorized" };
  }

  const header = parsePart(headerPart);
  const payload = parsePart(payloadPart);
  if (header.alg !== "RS256") {
    return { ok: false, error: "Unauthorized" };
  }
  const keys = await getJwks(host);
  const jwk = keys.find((key) => key.kid === header.kid);
  if (!jwk) return { ok: false, error: "Unauthorized" };

  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256" },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    b64UrlToBytes(signaturePart),
    new TextEncoder().encode(`${headerPart}.${payloadPart}`),
  );
  if (!valid) return { ok: false, error: "Unauthorized" };

  const issuer = `https://${host}`;
  if (payload.iss !== issuer || !audienceOk(payload.aud, audience)) {
    return { ok: false, error: "Unauthorized" };
  }
  if (Number(payload.exp || 0) * 1000 < Date.now()) {
    return { ok: false, error: "Unauthorized" };
  }

  const email = String(payload.email || headerEmail || "").trim().toLowerCase();
  const allow = String(env.ADMIN_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (allow.length && (!email || !allow.includes(email))) {
    return { ok: false, error: "This Google account is not allowed" };
  }

  return { ok: true, email };
}
