import {
  fetchExternalTranscript,
  type FetchExternalTranscriptInput,
} from "@/lib/supadata-transcript";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ runId: string; sourceKey: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { runId, sourceKey } = await context.params;
    const payload = (await request.json()) as FetchExternalTranscriptInput;
    return Response.json({
      result: await fetchExternalTranscript(runId, sourceKey, payload),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "External transcript fetch failed." },
      { status: 400 },
    );
  }
}
