import { validateProductionPackage } from "@/lib/package-validation";
import { readRunJson } from "@/lib/run-store";
import type { ProductionPackage } from "@/lib/runs";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

function assertSafeRunId(runId: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error("Invalid run id.");
  }
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { runId } = await context.params;
    assertSafeRunId(runId);
    const pkg = await readRunJson<ProductionPackage>(runId, "production-package.json");
    const result = validateProductionPackage(pkg);
    return Response.json({ result });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Validation failed." },
      { status: 400 },
    );
  }
}
