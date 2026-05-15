import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const ADMIN_TOKEN_ENV_NAMES = ["DASHBOARD_ADMIN_TOKEN", "YIF_ADMIN_TOKEN", "ADMIN_ACCESS_TOKEN"];
const LOGIN_CREDENTIAL_ENV_NAMES = [
  "DASHBOARD_ADMIN_PASSWORD",
  "DASHBOARD_ADMIN_TOKEN",
  "DASHBOARD_SESSION_SECRET",
  "YIF_ADMIN_TOKEN",
  "ADMIN_ACCESS_TOKEN",
];

function getConfiguredAdminToken() {
  for (const name of ADMIN_TOKEN_ENV_NAMES) {
    const value = process.env[name]?.trim();
    if (value) {
      return value;
    }
  }
  return "";
}

function requiresConfiguredToken() {
  return Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";
}

function hasConfiguredLogin() {
  return LOGIN_CREDENTIAL_ENV_NAMES.some((name) => Boolean(process.env[name]?.trim()));
}

function getPresentedToken(request: NextRequest) {
  const directToken = request.headers.get("x-yif-admin-token")?.trim();
  if (directToken) {
    return directToken;
  }

  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const [scheme, token] = authorization.split(/\s+/, 2);
  if (scheme?.toLowerCase() === "bearer" && token) {
    return token.trim();
  }

  return "";
}

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  if (SAFE_METHODS.has(request.method.toUpperCase())) {
    return NextResponse.next();
  }

  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (session) {
    if (request.nextUrl.pathname.startsWith("/api/admin/") && session.role !== "admin") {
      return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }
    return NextResponse.next();
  }

  const configuredToken = getConfiguredAdminToken();
  if (!configuredToken) {
    if (hasConfiguredLogin()) {
      return NextResponse.json(
        { error: "로그인이 필요합니다. /login에서 아이디와 비밀번호로 로그인하세요." },
        { status: 401 },
      );
    }

    if (!requiresConfiguredToken()) {
      return NextResponse.next();
    }

    return NextResponse.json(
      {
        error:
          "Production mutation APIs are locked. Set DASHBOARD_ADMIN_PASSWORD or DASHBOARD_SESSION_SECRET in the deployment environment.",
      },
      { status: 503 },
    );
  }

  if (getPresentedToken(request) === configuredToken) {
    return NextResponse.next();
  }

  return NextResponse.json(
    { error: "로그인이 필요합니다. /login에서 아이디와 비밀번호로 로그인하세요." },
    { status: 401 },
  );
}

export const config = {
  matcher: ["/api/:path*"],
};
