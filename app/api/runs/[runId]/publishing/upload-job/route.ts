import {
  createYouTubeUploadJob,
  type CreateYouTubeUploadJobRequest,
} from "@/lib/youtube-upload-job";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { runId } = await context.params;
    const payload = (await request.json()) as CreateYouTubeUploadJobRequest;
    return Response.json({ result: await createYouTubeUploadJob(runId, payload) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "YouTube upload job creation failed." },
      { status: 400 },
    );
  }
}
