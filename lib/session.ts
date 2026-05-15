export const SESSION_COOKIE_NAME = "yif_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type SessionRole = "admin" | "member";

export type SessionUser = {
  email: string;
  exp: number;
  id: string;
  name: string;
  role: SessionRole;
};

function base64UrlEncodeBytes(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecodeBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function getSessionSecret() {
  const secret =
    process.env.DASHBOARD_SESSION_SECRET?.trim() ||
    process.env.DASHBOARD_ADMIN_PASSWORD?.trim() ||
    process.env.DASHBOARD_ADMIN_TOKEN?.trim() ||
    process.env.YIF_ADMIN_TOKEN?.trim() ||
    process.env.ADMIN_ACCESS_TOKEN?.trim();

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    throw new Error("DASHBOARD_SESSION_SECRET or DASHBOARD_ADMIN_TOKEN is required.");
  }

  return "youtube-idea-factory-local-session-secret";
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSessionSecret()),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64UrlEncodeBytes(new Uint8Array(signature));
}

export async function createSessionToken(
  user: Omit<SessionUser, "exp">,
  maxAgeSeconds = SESSION_MAX_AGE_SECONDS,
) {
  const payload: SessionUser = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
  };
  const encodedPayload = base64UrlEncodeBytes(new TextEncoder().encode(JSON.stringify(payload)));
  return `${encodedPayload}.${await sign(encodedPayload)}`;
}

export async function verifySessionToken(token?: string | null): Promise<SessionUser | null> {
  if (!token) {
    return null;
  }

  const [payload, signature] = token.split(".", 2);
  if (!payload || !signature) {
    return null;
  }

  const expected = await sign(payload).catch(() => "");
  if (!expected || signature !== expected) {
    return null;
  }

  try {
    const decoded = new TextDecoder().decode(base64UrlDecodeBytes(payload));
    const session = JSON.parse(decoded) as SessionUser;
    if (!session.id || !session.email || !session.role || session.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}
