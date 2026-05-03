import { getRuns } from "@/lib/runs";

export const dynamic = "force-dynamic";

export async function GET() {
  const runs = await getRuns();
  return Response.json({ runs });
}

