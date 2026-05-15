import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME, type SessionRole, type SessionUser, verifySessionToken } from "@/lib/session";

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}

export async function requireUser(options: { role?: SessionRole; redirectTo?: string } = {}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect(options.redirectTo ?? "/login");
  }
  if (options.role && user.role !== options.role) {
    redirect("/dashboard");
  }
  return user;
}

export function canManageAdminArea(user: SessionUser | null) {
  return user?.role === "admin";
}
