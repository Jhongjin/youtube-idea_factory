import { promises as fs } from "node:fs";
import path from "node:path";
import type { AssetManifest, AssetManifestItem } from "@/lib/asset-manifest";
import type { GenerationQueue } from "@/lib/generation-queue";

export type AssetGenerationStateItem = {
  id: string;
  kind: AssetManifestItem["kind"];
  provider_role: AssetManifestItem["provider_role"];
  status: AssetManifestItem["status"];
  expected_path: string;
  prompt?: string;
  scene_id?: string;
  blockers: string[];
};

export type AssetGenerationState = {
  manifestExists: boolean;
  queueExists: boolean;
  summary: GenerationQueue["summary"] | null;
  items: AssetGenerationStateItem[];
};

const runsDir = path.join(/* turbopackIgnore: true */ process.cwd(), "runs");

function assertSafeRunId(runId: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error("Invalid run id.");
  }
}

async function loadJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf-8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function getAssetGenerationState(runId: string): Promise<AssetGenerationState> {
  assertSafeRunId(runId);
  const runDir = path.join(runsDir, runId);
  const [manifest, queue] = await Promise.all([
    loadJsonIfExists<AssetManifest>(path.join(runDir, "asset-manifest.json")),
    loadJsonIfExists<GenerationQueue>(path.join(runDir, "generation-queue.json")),
  ]);
  const queueBlockers = new Map(
    (queue?.items ?? []).map((item) => [item.id, item.blockers] as const),
  );

  return {
    manifestExists: Boolean(manifest),
    queueExists: Boolean(queue),
    summary: queue?.summary ?? null,
    items: (manifest?.items ?? []).map((item) => ({
      id: item.id,
      kind: item.kind,
      provider_role: item.provider_role,
      status: item.status,
      expected_path: item.actual_path || item.expected_path,
      prompt: item.prompt,
      scene_id: item.scene_id,
      blockers: queueBlockers.get(item.id) ?? [],
    })),
  };
}
