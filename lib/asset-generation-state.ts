import { readRunFileIfExists } from "@/lib/run-store";
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

function assertSafeRunId(runId: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error("Invalid run id.");
  }
}

async function loadRunJsonIfExists<T>(runId: string, filePath: string): Promise<T | null> {
  const content = await readRunFileIfExists(runId, filePath);
  return content ? (JSON.parse(content) as T) : null;
}

export async function getAssetGenerationState(runId: string): Promise<AssetGenerationState> {
  assertSafeRunId(runId);
  const [manifest, queue] = await Promise.all([
    loadRunJsonIfExists<AssetManifest>(runId, "asset-manifest.json"),
    loadRunJsonIfExists<GenerationQueue>(runId, "generation-queue.json"),
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
