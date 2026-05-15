import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    httpOnly: true,
    maxAge: 0,
    name: SESSION_COOKIE_NAME,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    value: "",
  });
  return response;
}
