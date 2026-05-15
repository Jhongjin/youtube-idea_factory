import { NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/session";
import { authenticateAppUser } from "@/lib/users";

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
