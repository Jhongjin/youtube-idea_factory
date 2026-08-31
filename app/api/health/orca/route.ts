import { getOrcaBackendMode, getOrcaGateHealth } from "@/lib/orca-control-plane";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await getOrcaGateHealth();
    const backend = getOrcaBackendMode();
    return Response.json({ status: "healthy", backend, gate: backend === "gate" ? "reachable" : "not_required" });
  } catch {
    return Response.json({ status: "degraded", backend: getOrcaBackendMode(), gate: "unreachable" }, { status: 503 });
  }
}
