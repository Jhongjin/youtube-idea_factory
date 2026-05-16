import { getCurrentUser } from "@/lib/auth";
import { createRun, type CreateRunInput } from "@/lib/create-run";
import { getRuns } from "@/lib/runs";

export const dynamic = "force-dynamic";

async function requireApiUser() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  return null;
}

export async function GET() {
  const unauthorized = await requireApiUser();
  if (unauthorized) {
    return unauthorized;
  }

  const runs = await getRuns();
  return Response.json({ runs });
}

export async function POST(request: Request) {
  const unauthorized = await requireApiUser();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const body = (await request.json()) as Partial<CreateRunInput>;
    const run = await createRun({
      topic: String(body.topic ?? ""),
      category: String(body.category ?? ""),
      channelId: String(body.channelId ?? ""),
      format: String(body.format ?? "shorts"),
      language: String(body.language ?? "ko"),
      targetAudience: String(body.targetAudience ?? ""),
      tone: String(body.tone ?? ""),
      durationSeconds: Number(body.durationSeconds ?? 60),
      seedUrls: Array.isArray(body.seedUrls) ? body.seedUrls.map(String) : [],
    });

    return Response.json({ run }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Run creation failed." },
      { status: 400 },
    );
  }
}
