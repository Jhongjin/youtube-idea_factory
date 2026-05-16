import { getProviderCapability } from "@/lib/provider-capabilities";
import { getProviderSettings, resolvePreferredProviderSetting } from "@/lib/provider-settings";
import { createRenderManifest, type RenderManifest } from "@/lib/render-manifest";
import type { ProductionPackage } from "@/lib/runs";
import { readRunJson, writeRunJson } from "@/lib/run-store";

export type EditingHandoff = {
  version: 1;
  run_id: string;
  created_at: string;
  provider: {
    role: "editing";
    provider: string;
    model: string;
    base_url: string;
    capability: ReturnType<typeof getProviderCapability>;
    notes: string;
  };
  output: RenderManifest["output"];
  timeline: Array<{
    scene_id: string;
    start_seconds: number;
    duration_seconds: number;
    source_path: string;
    source_kind: string;
    narration: string;
    on_screen_text: string;
  }>;
  audio: {
    voice_path: string;
    bgm_path: string;
  };
  subtitles: {
    path: string;
  };
  operator_notes: string[];
};

export type EditingHandoffResult = {
  file: "editing-handoff.json";
  provider: string;
  timelineItems: number;
};

function assertSafeRunId(runId: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error("Invalid run id.");
  }
}

export async function createEditingHandoff(runId: string): Promise<EditingHandoffResult> {
  assertSafeRunId(runId);
  await createRenderManifest(runId);
  const [pkg, manifest, providerSettings] = await Promise.all([
    readRunJson<ProductionPackage>(runId, "production-package.json"),
    readRunJson<RenderManifest>(runId, "render-manifest.json"),
    getProviderSettings(),
  ]);
  const editingProvider = resolvePreferredProviderSetting(providerSettings, "editing");
  const capability = getProviderCapability("editing", editingProvider.provider);
  const now = new Date().toISOString();
  const handoff: EditingHandoff = {
    version: 1,
    run_id: runId,
    created_at: now,
    provider: {
      role: "editing",
      provider: editingProvider.provider,
      model: editingProvider.model,
      base_url: editingProvider.baseUrl,
      capability,
      notes: editingProvider.notes,
    },
    output: manifest.output,
    timeline: manifest.timeline.map((item) => ({
      scene_id: item.scene_id,
      start_seconds: item.start_seconds,
      duration_seconds: item.duration_seconds,
      source_path: item.primary_asset_path,
      source_kind: item.primary_asset_kind,
      narration: item.narration,
      on_screen_text: item.on_screen_text,
    })),
    audio: {
      voice_path: manifest.audio.voice_path,
      bgm_path: manifest.audio.bgm_status === "generated" ? manifest.audio.bgm_path : "",
    },
    subtitles: {
      path: manifest.subtitles.path,
    },
    operator_notes: [
      "Use this packet as the external editing timeline source.",
      "Do not upload or publish until render and publish approval gates are complete.",
      "Register the exported MP4 back to the run before YouTube upload.",
    ],
  };

  pkg.render_manifest = {
    ...(pkg.render_manifest ?? {
      blockers: manifest.summary.blockers,
      path: "render-manifest.json",
      ready_timeline_items: manifest.summary.ready_timeline_items,
      render_ready: manifest.summary.render_ready,
      timeline_items: manifest.summary.timeline_items,
      updated_at: now,
    }),
    editing_handoff_path: "editing-handoff.json",
    editing_provider: editingProvider.provider,
    editing_provider_status: capability.status,
    updated_at: now,
  };

  await Promise.all([
    writeRunJson(runId, "editing-handoff.json", handoff),
    writeRunJson(runId, "production-package.json", pkg),
  ]);

  return {
    file: "editing-handoff.json",
    provider: editingProvider.provider,
    timelineItems: handoff.timeline.length,
  };
}
