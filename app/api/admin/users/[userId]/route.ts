import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { updateAppUser } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  await requireUser({ role: "admin" });
  const { userId } = await params;
  const body = (await request.json().catch(() => null)) as {
    name?: string;
    password?: string;
    role?: "admin" | "member";
    status?: "active" | "pending" | "disabled";
  } | null;

  try {
    const user = await updateAppUser(userId, {
      name: body?.name,
      password: body?.password,
      role: body?.role,
      status: body?.status,
    });
    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "사용자를 수정하지 못했습니다." },
      { status: 400 },
    );
  }
}
