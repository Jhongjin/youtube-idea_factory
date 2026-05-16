import { NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/session";
import { authenticateAppUser, getInactiveAppUserStatus } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    identifier?: string;
    password?: string;
  } | null;

  const identifier = body?.identifier?.trim() ?? "";
  const password = body?.password ?? "";
  if (!identifier || !password) {
    return NextResponse.json({ error: "아이디와 비밀번호를 입력하세요." }, { status: 400 });
  }

  const user = await authenticateAppUser(identifier, password);
  if (!user) {
    const inactiveStatus = await getInactiveAppUserStatus(identifier, password);
    if (inactiveStatus === "pending") {
      return NextResponse.json(
        {
          action: "admin-approval",
          error: "가입 요청이 승인 대기 중입니다. 관리자는 회원관리에서 이 계정을 활성화하세요.",
        },
        { status: 403 },
      );
    }
    if (inactiveStatus === "disabled") {
      return NextResponse.json({ error: "비활성화된 계정입니다. 관리자에게 문의하세요." }, { status: 403 });
    }
    return NextResponse.json({ error: "아이디 또는 비밀번호가 맞지 않습니다." }, { status: 401 });
  }

  const response = NextResponse.json({ user });
  response.cookies.set({
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_SECONDS,
    name: SESSION_COOKIE_NAME,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    value: await createSessionToken(user),
  });
  return response;
}
