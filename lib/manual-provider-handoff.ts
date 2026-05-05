import type { AssetManifest, AssetManifestItem } from "@/lib/asset-manifest";
import { getProviderCapability } from "@/lib/provider-capabilities";
import { getProviderSettings } from "@/lib/provider-settings";
import type { ProductionPackage } from "@/lib/runs";
import { readRunJson, writeRunFile, writeRunJson } from "@/lib/run-store";

export type ManualProviderHandoffItem = {
  asset_id: string;
  kind: AssetManifestItem["kind"];
  provider_role: AssetManifestItem["provider_role"];
  provider: string;
  model: string;
  capability: string;
  status: AssetManifestItem["status"];
  prompt: string;
  negative_prompt: string;
  narration: string;
  expected_path: string;
  registration_hint: string;
};

export type ManualProviderHandoff = {
  version: 1;
  run_id: string;
  created_at: string;
  items: ManualProviderHandoffItem[];
  notes: string[];
};

export type ManualProviderHandoffResult = {
  jsonFile: string;
  markdownFile: string;
  items: number;
};

const handoffJsonFile = "manual-provider-handoff.json";
const handoffMarkdownFile = "manual-provider-handoff.md";

function assertSafeRunId(runId: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error("Invalid run id.");
  }
}

function narrationFromPackage(pkg: ProductionPackage) {
  return pkg.storyboard
    .filter((scene): scene is { narration?: unknown } => typeof scene === "object" && scene !== null)
    .map((scene) => (typeof scene.narration === "string" ? scene.narration.trim() : ""))
    .filter(Boolean)
    .join("\n\n");
}

function promptFor(item: AssetManifestItem, pkg: ProductionPackage) {
  if (item.kind === "voice") {
    return narrationFromPackage(pkg);
  }
  if (item.kind === "subtitles") {
    return narrationFromPackage(pkg);
  }
  if (item.kind === "bgm") {
    return [
      `Topic: ${pkg.brief.topic}`,
      `Tone: ${pkg.brief.tone}`,
      "Use licensed or self-owned music only. Keep narration intelligible.",
    ].join("\n");
  }
  return item.prompt?.trim() ?? "";
}

function registrationHint(runId: string, expectedPath: string) {
  return `Generate the file externally, store it at ${expectedPath}, then register it in the dashboard for run ${runId}.`;
}

function providerRoleFor(item: AssetManifestItem): AssetManifestItem["provider_role"] {
  return item.provider_role;
}

function asHandoffItem(
  runId: string,
  item: AssetManifestItem,
  pkg: ProductionPackage,
  settings: Awaited<ReturnType<typeof getProviderSettings>>,
): ManualProviderHandoffItem | null {
  if (item.status === "generated" || item.status === "skipped") {
    return null;
  }
  const role = providerRoleFor(item);
  const provider = settings.roles[role].provider;
  const capability = getProviderCapability(role, provider);
  if (capability.status === "direct") {
    return null;
  }

  const prompt = promptFor(item, pkg);
  return {
    asset_id: item.id,
    capability: capability.label,
    expected_path: item.expected_path,
    kind: item.kind,
    model: settings.roles[role].model,
    narration: item.kind === "voice" || item.kind === "subtitles" ? prompt : "",
    negative_prompt: item.negative_prompt?.trim() ?? "",
    prompt,
    provider,
    provider_role: role,
    registration_hint: registrationHint(runId, item.expected_path),
    status: item.status,
  };
}

function renderMarkdown(handoff: ManualProviderHandoff) {
  const lines = [
    "# Manual Provider Handoff",
    "",
    `Run: ${handoff.run_id}`,
    `Created: ${handoff.created_at}`,
    "",
    "Use this packet when the selected provider is manual or adapter-pending. Generated files must be registered back into the dashboard before render.",
    "",
  ];

  if (handoff.items.length === 0) {
    lines.push("No manual or adapter-pending assets are currently waiting for handoff.", "");
    return lines.join("\n");
  }

  for (const item of handoff.items) {
    lines.push(
      `## ${item.asset_id}`,
      "",
      `- Kind: ${item.kind}`,
      `- Provider role: ${item.provider_role}`,
      `- Provider: ${item.provider || "not selected"}`,
      `- Model / preset: ${item.model || "not set"}`,
      `- Capability: ${item.capability}`,
      `- Current status: ${item.status}`,
      `- Expected path: ${item.expected_path}`,
      "",
      "Prompt:",
      "",
      "```text",
      item.prompt || "No prompt available. Draft media prompts or subtitles first.",
      "```",
      "",
    );
    if (item.negative_prompt) {
      lines.push("Negative prompt:", "", "```text", item.negative_prompt, "```", "");
    }
    lines.push(`Registration: ${item.registration_hint}`, "");
  }

  return lines.join("\n");
}

export async function createManualProviderHandoff(
  runId: string,
): Promise<ManualProviderHandoffResult> {
  assertSafeRunId(runId);
  const [pkg, manifest, settings] = await Promise.all([
    readRunJson<ProductionPackage>(runId, "production-package.json"),
    readRunJson<AssetManifest>(runId, "asset-manifest.json"),
    getProviderSettings(),
  ]);

  const handoff: ManualProviderHandoff = {
    version: 1,
    run_id: runId,
    created_at: new Date().toISOString(),
    items: manifest.items
      .map((item) => asHandoffItem(runId, item, pkg, settings))
      .filter((item): item is ManualProviderHandoffItem => item !== null),
    notes: [
      "This handoff never calls paid generation APIs.",
      "Use the dashboard asset registration form after external generation.",
      "Do not use copyrighted music, voices, or likenesses without approval.",
    ],
  };

  await Promise.all([
    writeRunJson(runId, handoffJsonFile, handoff),
    writeRunFile(runId, handoffMarkdownFile, renderMarkdown(handoff)),
  ]);

  return {
    items: handoff.items.length,
    jsonFile: handoffJsonFile,
    markdownFile: handoffMarkdownFile,
  };
}
