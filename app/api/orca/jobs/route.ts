import { buildOrcaWorkerJob, enqueueOrcaWorkerJob, OrcaGateRequestError, OrcaRemoteReadOnlyError } from "@/lib/orca-control-plane";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: "build" | "enqueue";
      runDir?: string;
      stage?: string;
      attempt?: number;
      job?: Record<string, unknown>;
    };
    if (body.action === "enqueue") {
      if (!body.job) return Response.json({error: "검증된 작업 계약이 필요합니다."}, {status: 400});
      return Response.json(await enqueueOrcaWorkerJob(body.job), {status: 201});
    }
    if (!body.runDir || !body.stage) {
      return Response.json({ error: "runDir와 stage가 필요합니다." }, { status: 400 });
    }
    const result = await buildOrcaWorkerJob({ runDir: body.runDir, stage: body.stage, attempt: body.attempt });
    return Response.json(result);
  } catch (error) {
    if (error instanceof OrcaGateRequestError) {
      return Response.json({error: error.message}, {status: error.status});
    }
    if (error instanceof OrcaRemoteReadOnlyError) {
      return Response.json({error: error.message}, {status: 409});
    }
    return Response.json(
      { error: "Gate Service에 연결할 수 없습니다." },
      { status: 503 },
    );
  }
}
