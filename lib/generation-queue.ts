import { getRunApprovals, type ApprovalGate, type RunApprovals } from "@/lib/approvals";
import type { AssetManifest, AssetManifestItem } from "@/lib/asset-manifest";
import { getProviderSettings } from "@/lib/provider-settings";
import { readRunJson, writeRunJson } from "@/lib/run-store";
import type { ProviderRoleId, ProviderRoleSetting } from "@/lib/provider-settings-shared";
import type { ProductionPackage } from "@/lib/runs";

export type GenerationQueueItem = {
  id: string;
  kind: AssetManifestItem["kind"];
  provider_role: AssetManifestItem["provider_role"];
  provider: string;
  model: string;
  status: AssetManifestItem["status"];
  previous_status: AssetManifestItem["status"];
  expected_path: string;
  prompt_id?: string;
  scene_id?: string;
  blockers: string[];
};

export type GenerationQueue = {
  version: 1;
  run_id: string;
  created_at: string;
  updated_at: string;
  approval_gate: "generation";
  summary: {
    total: number;
    ready: number;
    blocked: number;
    skipped: number;
    generated: number;
    failed: number;
  };
  items: GenerationQueueItem[];
};

export type GenerationQueueResult = {
  file: string;
  total: number;
  ready: number;
  blocked: number;
  skipped: number;
  generated: number;
  failed: number;
};

function assertSafeRunId(runId: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error("Invalid run id.");
  }
}

function providerAllowsNoKey(provider: string) {
  const normalized = provider.toLowerCase();
  return normalized.includes("local") || normalized.includes("manual");
}

function providerNeedsModel(provider: string) {
  return !providerAllowsNoKey(provider);
}

function approvalBlockers(approvals: RunApprovals, gate: ApprovalGate) {
  const approval = approvals[gate];
  const blockers: string[] = [];
  if (approval.approved !== true) {
    blockers.push(`${gate} approval is not granted`);
  }
  if (!approval.approved_by.trim()) {
    blockers.push(`${gate} approval is missing approved_by`);
  }
  if (!approval.approved_at.trim()) {
    blockers.push(`${gate} approval is missing approved_at`);
  }
  return blockers;
}

function providerBlockers(setting: ProviderRoleSetting) {
  const blockers: string[] = [];
  if (setting.enabled !== true) {
    blockers.push(`${setting.role} provider is not enabled`);
  }
  if (!setting.provider.trim()) {
    blockers.push(`${setting.role} provider is empty`);
  }
  if (!setting.apiKey?.trim() && !providerAllowsNoKey(setting.provider)) {
    blockers.push(`${setting.role} API key is missing`);
  }
  if (providerNeedsModel(setting.provider) && !setting.model.trim()) {
    blockers.push(`${setting.role} model is missing`);
  }
  if (setting.provider.toLowerCase() === "custom" && !setting.baseUrl.trim()) {
    blockers.push(`${setting.role} custom provider base URL is missing`);
  }
  return blockers;
}

function itemBlockers(item: AssetManifestItem) {
  const blockers: string[] = [];
  if (!item.expected_path.trim()) {
    blockers.push("expected_path is empty");
  }
  if (
    ["image", "video", "thumbnail"].includes(item.kind) &&
    !item.prompt?.trim()
  ) {
    blockers.push("prompt is empty");
  }
  return blockers;
}

function terminalStatus(status: AssetManifestItem["status"]) {
  return status === "generated" || status === "skipped" || status === "failed";
}

export async function createGenerationQueue(runId: string): Promise<GenerationQueueResult> {
  assertSafeRunId(runId);
  const [pkg, manifest, approvals, providerSettings] = await Promise.all([
    readRunJson<ProductionPackage>(runId, "production-package.json"),
    readRunJson<AssetManifest>(runId, "asset-manifest.json").catch(() => {
      throw new Error("Asset manifest not found. Build assets first.");
    }),
    getRunApprovals(runId),
    getProviderSettings(),
  ]);

  const now = new Date().toISOString();
  const runBlockers = pkg.qa.status === "blocked" ? ["qa.status is blocked"] : [];
  const queueItems: GenerationQueueItem[] = manifest.items.map((item) => {
    const setting = providerSettings.roles[item.provider_role as ProviderRoleId];
    const previousStatus = item.status;
    const blockers = terminalStatus(item.status)
      ? []
      : [
          ...runBlockers,
          ...approvalBlockers(approvals, item.approval_gate),
          ...providerBlockers(setting),
          ...itemBlockers(item),
        ];
    const status = terminalStatus(item.status)
      ? item.status
      : blockers.length > 0
        ? "pending_approval"
        : "pending_generation";

    item.status = status;
    return {
      id: item.id,
      kind: item.kind,
      provider_role: item.provider_role,
      provider: setting.provider,
      model: setting.model,
      status,
      previous_status: previousStatus,
      expected_path: item.expected_path,
      prompt_id: item.prompt_id,
      scene_id: item.scene_id,
      blockers,
    };
  });

  manifest.updated_at = now;

  const queue: GenerationQueue = {
    version: 1,
    run_id: runId,
    created_at: now,
    updated_at: now,
    approval_gate: "generation",
    summary: {
      total: queueItems.length,
      ready: queueItems.filter((item) => item.status === "pending_generation").length,
      blocked: queueItems.filter((item) => item.blockers.length > 0).length,
      skipped: queueItems.filter((item) => item.status === "skipped").length,
      generated: queueItems.filter((item) => item.status === "generated").length,
      failed: queueItems.filter((item) => item.status === "failed").length,
    },
    items: queueItems,
  };

  await Promise.all([
    writeRunJson(runId, "asset-manifest.json", manifest),
    writeRunJson(runId, "generation-queue.json", queue),
  ]);

  pkg.asset_manifest = {
    path: "asset-manifest.json",
    items: manifest.items.length,
    pending_approval: manifest.items.filter((item) => item.status === "pending_approval").length,
    ready_for_generation: queue.summary.ready,
    blocked: queue.summary.blocked,
    updated_at: now,
  };
  await writeRunJson(runId, "production-package.json", pkg);

  return {
    file: "generation-queue.json",
    ...queue.summary,
  };
}
