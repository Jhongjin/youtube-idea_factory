import {
  batchFetchExternalTranscripts,
  type BatchFetchTranscriptsInput,
} from "@/lib/transcript-batch-fetch";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { runId } = await context.params;
    const payload = (await request.json()) as BatchFetchTranscriptsInput;
    return Response.json({
      result: await batchFetchExternalTranscripts(runId, payload),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Batch transcript fetch failed." },
      { status: 400 },
    );
  }
}
