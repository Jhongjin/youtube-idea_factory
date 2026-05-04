import { createSubtitleDraft } from "@/lib/subtitle-draft";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { runId } = await context.params;
    return Response.json({ result: await createSubtitleDraft(runId) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Subtitle draft failed." },
      { status: 400 },
    );
  }
}
