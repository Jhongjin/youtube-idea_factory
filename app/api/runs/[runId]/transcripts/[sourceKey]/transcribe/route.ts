import {
  transcribeAudioWithOpenAI,
  type TranscribeAudioRequest,
} from "@/lib/openai-transcription";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ runId: string; sourceKey: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { runId, sourceKey } = await context.params;
    const payload = (await request.json()) as TranscribeAudioRequest;
    return Response.json({
      result: await transcribeAudioWithOpenAI(runId, sourceKey, payload),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Audio transcription failed." },
      { status: 400 },
    );
  }
}
