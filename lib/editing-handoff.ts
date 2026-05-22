import { getProviderCapability } from "@/lib/provider-capabilities";
import {
  getProviderSettings,
  resolvePreferredProviderSetting,
  resolveProviderSetting,
} from "@/lib/provider-settings";
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
  workflow: {
    recommended_action: string;
    import_format: string;
    export_expectation: string;
    tool_notes: string[];
  };
  edit_decision_list: {
    path: string;
    engine: string;
    optional_motion_engines: string[];
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

export type EditingHandoffOptions = {
  providerProfileId?: string;
};

function assertSafeRunId(runId: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error("Invalid run id.");
  }
}

function workflowForProvider(provider: string): EditingHandoff["workflow"] {
  const normalized = provider.toLowerCase();
  if (normalized.includes("opencut")) {
    return {
      recommended_action: "Create an OpenCut project and import the timeline assets manually.",
      import_format: "Use timeline[].source_path for media, audio.voice_path for narration, and subtitles.path for captions.",
      export_expectation: "Export MP4 to output.final_path, then register the exported file in the dashboard.",
      tool_notes: [
        "OpenCut is best treated as a visual timeline editor in this harness.",
        "Keep publish approval separate from the editing export.",
      ],
    };
  }
  if (normalized.includes("hyperframes")) {
    return {
      recommended_action: "Generate an HTML/CSS/JS render from the timeline data.",
      import_format: "Map each timeline item to a scene block with source_path, narration, on_screen_text, and duration_seconds.",
      export_expectation: "Render MP4 to output.final_path and register the exported artifact.",
      tool_notes: [
        "HyperFrames is a good fit for agent-authored motion layouts.",
        "Use the provider model/workflow field for a house template or render preset id.",
      ],
    };
  }
  if (normalized.includes("remotion")) {
    return {
      recommended_action: "Convert the handoff timeline into a Remotion composition payload.",
      import_format: "Use timeline durations, output resolution, audio paths, and subtitle path as composition props.",
      export_expectation: "Render MP4 to output.final_path and write render-log.json after completion.",
      tool_notes: [
        "Remotion is the preferred path for repeatable React-based motion templates.",
        "Keep generated composition code in the repo or a dedicated render worker workspace.",
      ],
    };
  }
  if (normalized.includes("creatomate") || normalized.includes("shotstack") || normalized.includes("veed")) {
    return {
      recommended_action: "Translate this handoff into the provider timeline/template API.",
      import_format: "Map scenes to clips, narration to audio, captions to subtitle layers, and output.final_path to the export target.",
      export_expectation: "Poll the provider render job, then register the delivered MP4.",
      tool_notes: [
        "This path should stay behind the render approval gate because it can create external spend.",
        "Store provider job id and cost in render-log.json when the adapter is implemented.",
      ],
    };
  }
  return {
    recommended_action: "Use this packet as the external editing timeline source.",
    import_format: "Timeline, audio, subtitles, and output paths are normalized for handoff.",
    export_expectation: "Export MP4 to output.final_path and register it before YouTube upload.",
    tool_notes: [
      "Do not upload or publish until render and publish approval gates are complete.",
      "Use manual file registration when the editing provider does not have a direct adapter.",
    ],
  };
}

export async function createEditingHandoff(
  runId: string,
  options: EditingHandoffOptions = {},
): Promise<EditingHandoffResult> {
  assertSafeRunId(runId);
  await createRenderManifest(runId);
  const [pkg, manifest, providerSettings] = await Promise.all([
    readRunJson<ProductionPackage>(runId, "production-package.json"),
    readRunJson<RenderManifest>(runId, "render-manifest.json"),
    getProviderSettings(),
  ]);
  const editingProvider = options.providerProfileId
    ? resolveProviderSetting(providerSettings, "editing", options.providerProfileId)
    : resolvePreferredProviderSetting(providerSettings, "editing");
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
    workflow: workflowForProvider(editingProvider.provider),
    edit_decision_list: {
      path: manifest.edit_decision_list.path,
      engine: manifest.edit_decision_list.engine,
      optional_motion_engines: ["HyperFrames", "Remotion", "OpenCut"],
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
    edl_path: manifest.edit_decision_list.path,
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
