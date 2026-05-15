import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  return Response.json({
    ok: true,
    user,
    verifiedAt: new Date().toISOString(),
  });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  return Response.json({
    ok: true,
    user,
    verifiedAt: new Date().toISOString(),
  });
}
