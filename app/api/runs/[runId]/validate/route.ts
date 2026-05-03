import { promises as fs } from "node:fs";
import path from "node:path";
import { validateProductionPackage } from "@/lib/package-validation";

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
    const packagePath = path.join(
      /* turbopackIgnore: true */ process.cwd(),
      "runs",
      runId,
      "production-package.json",
    );
    const raw = await fs.readFile(packagePath, "utf-8");
    const result = validateProductionPackage(JSON.parse(raw));
    return Response.json({ result });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Validation failed." },
      { status: 400 },
    );
  }
}

