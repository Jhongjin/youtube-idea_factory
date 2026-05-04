import { generateOpenAITts, type GenerateVoiceRequest } from "@/lib/openai-tts-generation";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { runId } = await context.params;
    const payload = (await request.json()) as GenerateVoiceRequest;
    return Response.json({ result: await generateOpenAITts(runId, payload) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Voice generation failed." },
      { status: 400 },
    );
  }
}
