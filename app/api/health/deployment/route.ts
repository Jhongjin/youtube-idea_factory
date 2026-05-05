import { getDeploymentReadiness } from "@/lib/deployment-readiness";

export const dynamic = "force-dynamic";

export async function GET() {
  const readiness = await getDeploymentReadiness();
  return Response.json({
    status: readiness.blockers.length === 0 ? "ready" : "blocked",
    readiness,
  });
}
