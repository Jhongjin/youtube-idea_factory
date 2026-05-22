import { getRunApprovals } from "@/lib/approvals";
import type { AssetManifest, AssetManifestItem } from "@/lib/asset-manifest";
import { assetExists } from "@/lib/asset-storage";
import type { ProductionPackage } from "@/lib/runs";
import { readRunJson, writeRunJson } from "@/lib/run-store";

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
    category_id: string;
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

function assertSafeRunId(runId: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error("Invalid run id.");
  }
}

async function loadRunJsonIfExists<T>(runId: string, filePath: string): Promise<T | null> {
  return readRunJson<T>(runId, filePath).catch((error) => {
    if (error instanceof Error && error.message.includes("Run file not found")) {
      return null;
    }
    return null;
  });
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

async function artifactBlockers(runId: string, artifactPath: string, label: string) {
  if (!artifactPath.trim()) {
    return [`${label} path is empty`];
  }
  const exists = await assetExists(runId, artifactPath).catch(() => false);
  if (!exists) {
    return [`${label} file does not exist`];
  }
  return [];
}

function deterministicPublishGateBlockers(pkg: ProductionPackage) {
  const blockers: string[] = [];
  const imageCount = Array.isArray(pkg.media_prompts.image_prompts)
    ? pkg.media_prompts.image_prompts.length
    : 0;
  const videoCount = Array.isArray(pkg.media_prompts.video_prompts)
    ? pkg.media_prompts.video_prompts.length
    : 0;
  if (pkg.qa.status === "blocked") {
    blockers.push("qa.status is blocked");
  }
  if (imageCount + videoCount === 0) {
    blockers.push("media prompts are empty");
  }
  if (pkg.render_manifest?.render_ready !== true) {
    blockers.push("render_manifest.render_ready must be true");
  }
  if ((pkg.publishing_package.title_candidates?.length ?? 0) === 0) {
    blockers.push("publishing title candidates are empty");
  }
  if (pkg.qa.publish_readiness !== "ready") {
    blockers.push("qa.publish_readiness must be ready for publishing");
  }
  return blockers;
}

export async function createPublishingHandoff(runId: string): Promise<PublishingHandoffResult> {
  assertSafeRunId(runId);
  const [pkg, assetManifest, renderManifest, approvals] = await Promise.all([
    readRunJson<ProductionPackage>(runId, "production-package.json"),
    loadRunJsonIfExists<AssetManifest>(runId, "asset-manifest.json"),
    loadRunJsonIfExists<MinimalRenderManifest>(runId, "render-manifest.json"),
    getRunApprovals(runId),
  ]);

  const now = new Date().toISOString();
  const title = pkg.publishing_package.title_candidates?.[0]?.trim() ?? "";
  const description = pkg.publishing_package.description?.trim() ?? "";
  const tags = (pkg.publishing_package.tags ?? []).filter((tag) => tag.trim());
  const videoPath = pkg.render_manifest?.rendered_path || renderManifest?.output?.final_path || "";
  const rawVideoBlockers = await artifactBlockers(runId, videoPath, "video");
  const videoExists = rawVideoBlockers.length === 0;
  const videoBlockers = [...rawVideoBlockers];
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
  const rawThumbnailBlockers = await artifactBlockers(runId, thumbnailPath, "thumbnail");
  const thumbnailExists = rawThumbnailBlockers.length === 0;
  const thumbnailBlockers = [...rawThumbnailBlockers];
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

  const scriptBlockers = deterministicPublishGateBlockers(pkg);
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
      category_id: pkg.brief.category_id ?? "",
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
    writeRunJson(runId, "publish-handoff.json", handoff),
    writeRunJson(runId, "production-package.json", pkg),
  ]);

  return {
    file: "publish-handoff.json",
    ready: handoff.summary.ready,
    blockers: handoff.summary.blockers,
  };
}
