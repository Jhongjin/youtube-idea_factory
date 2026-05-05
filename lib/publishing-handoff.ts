import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { getRunApprovals } from "@/lib/approvals";
import type { AssetManifest, AssetManifestItem } from "@/lib/asset-manifest";
import type { ProductionPackage } from "@/lib/runs";
import { isSupabaseStorageMode } from "@/lib/storage-mode";

type MinimalRenderManifest = {
  output?: {
    final_path?: string;
  };
};

export type PublishingHandoff = {
  version: 1;
  run_id: string;
  created_at: string;
  updated_at: string;
  video: {
    path: string;
    exists: boolean;
    blockers: string[];
  };
  thumbnail: {
    asset_id: string;
    path: string;
    status: AssetManifestItem["status"] | "missing";
    exists: boolean;
    blockers: string[];
  };
  metadata: {
    title: string;
    description: string;
    tags: string[];
    language: string;
    category: string;
    blockers: string[];
  };
  approvals: {
    publish: {
      approved: boolean;
      approved_by: string;
      approved_at: string;
    };
    blockers: string[];
  };
  policy: {
    qa_status: ProductionPackage["qa"]["status"];
    publish_readiness: string;
    blockers: string[];
  };
  summary: {
    blockers: number;
    ready: boolean;
  };
};

export type PublishingHandoffResult = {
  file: string;
  ready: boolean;
  blockers: number;
};

const execFileAsync = promisify(execFile);
const runsDir = path.join(/* turbopackIgnore: true */ process.cwd(), "runs");
const artifactsDir = path.join(/* turbopackIgnore: true */ process.cwd(), "artifacts");

function assertSafeRunId(runId: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error("Invalid run id.");
  }
}

async function loadJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, "utf-8")) as T;
}

async function loadJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    return await loadJson<T>(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function writeJson(filePath: string, data: unknown) {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

async function fileExists(filePath: string) {
  try {
    return (await fs.stat(filePath)).isFile();
  } catch {
    return false;
  }
}

function artifactResolution(runId: string, artifactPath: string, label: string) {
  const blockers: string[] = [];
  if (!artifactPath.trim()) {
    return { path: "", blockers: [`${label} path is empty`] };
  }

  const root = path.join(artifactsDir, runId);
  const resolved = path.resolve(/* turbopackIgnore: true */ process.cwd(), artifactPath);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    blockers.push(`${label} path must stay inside artifacts/:runId`);
  }

  return { path: resolved, blockers };
}

function assetPath(item?: AssetManifestItem) {
  return item?.actual_path || item?.expected_path || "";
}

function approvalBlockers(approval: { approved: boolean; approved_by: string; approved_at: string }) {
  const blockers: string[] = [];
  if (approval.approved !== true) {
    blockers.push("publish approval is not granted");
  }
  if (!approval.approved_by.trim()) {
    blockers.push("publish approval is missing approved_by");
  }
  if (!approval.approved_at.trim()) {
    blockers.push("publish approval is missing approved_at");
  }
  return blockers;
}

async function gateScriptBlockers(runDir: string) {
  const scriptPath = path.join(
    /* turbopackIgnore: true */ process.cwd(),
    "scripts",
    "check_approval_gate.py",
  );
  try {
    await execFileAsync("python", [scriptPath, runDir, "--gate", "publish"], {
      maxBuffer: 1024 * 1024,
    });
    return [];
  } catch (error) {
    const output = [
      (error as { stdout?: string }).stdout,
      (error as { stderr?: string }).stderr,
    ]
      .filter(Boolean)
      .join("\n");
    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith("- "))
      .map((line) => line.slice(2));
  }
}

export async function createPublishingHandoff(runId: string): Promise<PublishingHandoffResult> {
  assertSafeRunId(runId);
  if (isSupabaseStorageMode()) {
    throw new Error("Publishing handoff currently checks local render and thumbnail files. Supabase Storage support is next.");
  }
  const runDir = path.join(runsDir, runId);
  const packagePath = path.join(runDir, "production-package.json");
  const [pkg, assetManifest, renderManifest, approvals] = await Promise.all([
    loadJson<ProductionPackage>(packagePath),
    loadJsonIfExists<AssetManifest>(path.join(runDir, "asset-manifest.json")),
    loadJsonIfExists<MinimalRenderManifest>(path.join(runDir, "render-manifest.json")),
    getRunApprovals(runId),
  ]);

  const now = new Date().toISOString();
  const title = pkg.publishing_package.title_candidates?.[0]?.trim() ?? "";
  const description = pkg.publishing_package.description?.trim() ?? "";
  const tags = (pkg.publishing_package.tags ?? []).filter((tag) => tag.trim());
  const videoPath = pkg.render_manifest?.rendered_path || renderManifest?.output?.final_path || "";
  const videoResolution = artifactResolution(runId, videoPath, "video");
  const videoExists = videoResolution.path ? await fileExists(videoResolution.path) : false;
  const videoBlockers = [...videoResolution.blockers];
  if (!pkg.render_manifest?.render_ready) {
    videoBlockers.push("render_manifest.render_ready is not true");
  }
  if (!pkg.render_manifest?.rendered_path) {
    videoBlockers.push("final rendered_path is missing");
  }
  if (!videoExists) {
    videoBlockers.push("final video file does not exist");
  }

  const thumbnailAsset = assetManifest?.items.find((item) => item.kind === "thumbnail");
  const thumbnailPath = assetPath(thumbnailAsset);
  const thumbnailResolution = artifactResolution(runId, thumbnailPath, "thumbnail");
  const thumbnailExists = thumbnailResolution.path
    ? await fileExists(thumbnailResolution.path)
    : false;
  const thumbnailBlockers = [...thumbnailResolution.blockers];
  if (!thumbnailAsset) {
    thumbnailBlockers.push("thumbnail asset is missing from asset-manifest.json");
  } else if (thumbnailAsset.status !== "generated") {
    thumbnailBlockers.push(`thumbnail asset status is ${thumbnailAsset.status}`);
  }
  if (!thumbnailExists) {
    thumbnailBlockers.push("thumbnail file does not exist");
  }

  const metadataBlockers = [];
  if (!title) {
    metadataBlockers.push("title is missing");
  }
  if (!description) {
    metadataBlockers.push("description is missing");
  }

  const publishApproval = approvals.publish;
  const policyBlockers = [];
  if (pkg.qa.status !== "pass") {
    policyBlockers.push(`qa.status is ${pkg.qa.status}`);
  }
  if (pkg.qa.publish_readiness !== "ready") {
    policyBlockers.push("qa.publish_readiness is not ready");
  }

  const scriptBlockers = await gateScriptBlockers(runDir);
  const allBlockers = [
    ...videoBlockers,
    ...thumbnailBlockers,
    ...metadataBlockers,
    ...approvalBlockers(publishApproval),
    ...policyBlockers,
    ...scriptBlockers,
  ];
  const handoff: PublishingHandoff = {
    version: 1,
    run_id: runId,
    created_at: now,
    updated_at: now,
    video: {
      path: videoPath,
      exists: videoExists,
      blockers: videoBlockers,
    },
    thumbnail: {
      asset_id: thumbnailAsset?.id ?? "",
      path: thumbnailPath,
      status: thumbnailAsset?.status ?? "missing",
      exists: thumbnailExists,
      blockers: thumbnailBlockers,
    },
    metadata: {
      title,
      description,
      tags,
      language: pkg.brief.language,
      category: pkg.brief.category ?? "",
      blockers: metadataBlockers,
    },
    approvals: {
      publish: {
        approved: publishApproval.approved,
        approved_by: publishApproval.approved_by,
        approved_at: publishApproval.approved_at,
      },
      blockers: approvalBlockers(publishApproval),
    },
    policy: {
      qa_status: pkg.qa.status,
      publish_readiness: pkg.qa.publish_readiness ?? "not ready",
      blockers: policyBlockers,
    },
    summary: {
      blockers: allBlockers.length,
      ready: allBlockers.length === 0,
    },
  };

  pkg.publishing_handoff = {
    path: "publish-handoff.json",
    ready: handoff.summary.ready,
    blockers: handoff.summary.blockers,
    updated_at: now,
  };

  await Promise.all([
    writeJson(path.join(runDir, "publish-handoff.json"), handoff),
    writeJson(packagePath, pkg),
  ]);

  return {
    file: "publish-handoff.json",
    ready: handoff.summary.ready,
    blockers: handoff.summary.blockers,
  };
}
