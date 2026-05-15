import { NextResponse } from "next/server";
import { createAppUser } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    name?: string;
    password?: string;
  } | null;

  try {
    const user = await createAppUser({
      email: body?.email ?? "",
      name: body?.name ?? "",
      password: body?.password ?? "",
      role: "member",
      status: "pending",
    });
    return NextResponse.json({
      message: "가입 요청이 접수되었습니다. 관리자가 승인하면 로그인할 수 있습니다.",
      user,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "회원가입 요청을 저장하지 못했습니다." },
      { status: 400 },
    );
  }
}
