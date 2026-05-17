import { importRunSources, type ImportSourcesInput } from "@/lib/run-source-import";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { runId } = await context.params;
    const body = (await request.json()) as Partial<ImportSourcesInput>;
    const result = await importRunSources(runId, {
      candidates: Array.isArray(body.candidates) ? body.candidates : [],
      mode: body.mode === "replace" ? "replace" : "append",
      seedUrls: Array.isArray(body.seedUrls) ? body.seedUrls.map(String) : [],
    });

    return Response.json({ result });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Source import failed." },
      { status: 400 },
    );
  }
}

