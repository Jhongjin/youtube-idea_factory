import { NextResponse } from "next/server";
import { getWorkQueueSummary, phaseWorkQueue } from "@/lib/work-queue";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    queue: phaseWorkQueue,
    summary: getWorkQueueSummary(),
  });
}
