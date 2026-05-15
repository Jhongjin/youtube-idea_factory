import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAppUser } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await requireUser({ role: "admin" });
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    name?: string;
    password?: string;
    role?: "admin" | "member";
    status?: "active" | "pending" | "disabled";
  } | null;

  try {
    const user = await createAppUser({
      email: body?.email ?? "",
      name: body?.name ?? "",
      password: body?.password ?? "",
      role: body?.role ?? "member",
      status: body?.status ?? "active",
    });
    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "사용자를 만들지 못했습니다." },
      { status: 400 },
    );
  }
}
