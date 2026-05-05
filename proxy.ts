import { NextResponse, type NextRequest } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const ADMIN_TOKEN_ENV_NAMES = ["DASHBOARD_ADMIN_TOKEN", "YIF_ADMIN_TOKEN", "ADMIN_ACCESS_TOKEN"];

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

export function proxy(request: NextRequest) {
  if (SAFE_METHODS.has(request.method.toUpperCase())) {
    return NextResponse.next();
  }

  const configuredToken = getConfiguredAdminToken();
  if (!configuredToken) {
    if (!requiresConfiguredToken()) {
      return NextResponse.next();
    }

    return NextResponse.json(
      {
        error:
          "Production mutation APIs are locked. Set DASHBOARD_ADMIN_TOKEN in the deployment environment, then enter it in the dashboard.",
      },
      { status: 503 },
    );
  }

  if (getPresentedToken(request) === configuredToken) {
    return NextResponse.next();
  }

  return NextResponse.json(
    { error: "관리자 토큰이 필요합니다. 대시보드에서 DASHBOARD_ADMIN_TOKEN 값을 입력하세요." },
    { status: 401 },
  );
}

export const config = {
  matcher: ["/api/:path*"],
};
