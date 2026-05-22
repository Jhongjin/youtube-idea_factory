import { readRunFileIfExists, readRunJson, writeRunFile, writeRunJson } from "@/lib/run-store";
import type { ProductionPackage } from "@/lib/runs";

export type QaDraftResult = {
  status: "pass" | "blocked" | "needs_review";
  blockers: number;
  warnings: number;
  file: string;
};

function assertSafeRunId(runId: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error("Invalid run id.");
  }
}

function countClaimStatusFromPackage(pkg: ProductionPackage, status: string) {
  return pkg.claim_ledger.filter((claim) => {
    if (typeof claim !== "object" || claim === null) {
      return false;
    }
    return (claim as { status?: string }).status === status;
  }).length;
}

function countClaimStatusFromMarkdown(claimLedger: string, status: string) {
  return claimLedger
    .split(/\r?\n/)
    .filter((line) => line.startsWith("|") && line.toLowerCase().includes(`| ${status} |`))
    .length;
}

function countClaimStatus(pkg: ProductionPackage, claimLedger: string, status: string) {
  return Math.max(
    countClaimStatusFromPackage(pkg, status),
    countClaimStatusFromMarkdown(claimLedger, status),
  );
}

function countStoryboardScenes(storyboard: string) {
  return storyboard
    .split(/\r?\n/)
    .filter((line) => {
      if (!line.startsWith("| S")) {
        return false;
      }
      const [scene] = line.split("|").slice(1, -1).map((cell) => cell.trim());
      return /^S\d+/i.test(scene);
    }).length;
}

function hasPendingMarkers(content: string) {
  return /\bPending\b|대기|TODO/i.test(content);
}

function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasTranscript(source: ProductionPackage["sources"][number]) {
  return (
    source.transcript_status === "manual_transcript" ||
    source.transcript_status === "external_transcript" ||
    source.transcript_status === "stt_transcript" ||
    source.transcript_status === "available"
  );
}

function bulletList(items: string[]) {
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- None";
}

export async function createQaDraft(runId: string): Promise<QaDraftResult> {
  assertSafeRunId(runId);
  const pkg = await readRunJson<ProductionPackage>(runId, "production-package.json");
  const [claimLedger, scriptPlan, storyboard, mediaPrompts, publishingPackage] = await Promise.all([
    readRunFileIfExists(runId, "03-claim-ledger.md").then((value) => value ?? ""),
    readRunFileIfExists(runId, "04-script-plan.md").then((value) => value ?? ""),
    readRunFileIfExists(runId, "05-storyboard.md").then((value) => value ?? ""),
    readRunFileIfExists(runId, "06-media-prompts.md").then((value) => value ?? ""),
    readRunFileIfExists(runId, "07-publishing-package.md").then((value) => value ?? ""),
  ]);

  const supported = countClaimStatus(pkg, claimLedger, "supported");
  const needsEvidence = countClaimStatus(pkg, claimLedger, "needs_evidence");
  const highRisk = countClaimStatus(pkg, claimLedger, "high_risk");
  const doNotUse = countClaimStatus(pkg, claimLedger, "do_not_use");
  const storyboardScenes = Math.max(pkg.storyboard.length, countStoryboardScenes(storyboard));
  const imagePrompts = pkg.media_prompts.image_prompts?.length ?? 0;
  const videoPrompts = pkg.media_prompts.video_prompts?.length ?? 0;
  const assetManifestItems = pkg.asset_manifest?.items ?? 0;
  const titleCount = pkg.publishing_package.title_candidates?.length ?? 0;
  const missingTranscriptCount = pkg.sources.filter(
    (source) => !source.analysis_excluded && !hasTranscript(source),
  ).length;

  const blockers: string[] = [];
  const warnings: string[] = [];
  const fixList: string[] = [];

  if (pkg.sources.length === 0) {
    blockers.push("No source videos are attached to the run.");
    fixList.push("01-research.md: add source videos through YouTube Finder or manual seed URLs.");
  }

  if (supported === 0) {
    blockers.push("No supported claims are recorded yet.");
    fixList.push("03-claim-ledger.md: verify claims and mark at least one safe claim as supported.");
  }

  if (needsEvidence > 0 || highRisk > 0) {
    blockers.push(
      `Claim ledger has unresolved risk: ${needsEvidence} needs_evidence, ${highRisk} high_risk.`,
    );
    fixList.push("03-claim-ledger.md: resolve, remove, or reframe unresolved claim rows before publishing.");
  }

  if (doNotUse > 0) {
    warnings.push(`${doNotUse} claim ledger rows are marked do_not_use and must stay out of the final script.`);
  }

  if (hasPendingMarkers(scriptPlan)) {
    blockers.push("Script plan still contains pending placeholders.");
    fixList.push("04-script-plan.md: replace pending narration sections with a reviewed source-backed draft.");
  }

  if (storyboardScenes === 0) {
    blockers.push("Storyboard has no scene cards.");
    fixList.push("05-storyboard.md: draft and review scene cards before media generation.");
  }

  if (imagePrompts + videoPrompts === 0 || mediaPrompts.trim().length === 0) {
    blockers.push("Media prompts are not ready.");
    fixList.push("06-media-prompts.md: generate and review image/video prompts before paid generation.");
  }

  if (imagePrompts + videoPrompts > 0 && assetManifestItems === 0) {
    warnings.push("Asset manifest is not built yet.");
    fixList.push("Build asset-manifest.json before calling paid generation adapters.");
  }

  if (titleCount === 0 || !hasText(pkg.publishing_package.description)) {
    blockers.push("Publishing package is missing title candidates or description.");
    fixList.push("07-publishing-package.md: draft title, description, tags, and thumbnail prompt.");
  }

  if (publishingPackage.trim().length === 0) {
    blockers.push("Publishing artifact is empty.");
  }

  if (missingTranscriptCount > 0) {
    warnings.push(`${missingTranscriptCount} source video transcript slot is not filled yet.`);
    fixList.push("Sources panel: add missing manual transcripts or document why transcript review is not required.");
  }

  if (pkg.media_prompts.image_prompts?.some((prompt) => typeof prompt !== "object")) {
    warnings.push("Some image prompt records are not structured objects.");
  }

  warnings.push("Paid generation, final render, and YouTube upload still require explicit human approval.");

  const status: "pass" | "blocked" | "needs_review" =
    blockers.length > 0 ? "blocked" : pkg.qa.approval_required === false ? "pass" : "needs_review";
  const publishReadiness = blockers.length > 0 ? "not ready" : "render-only ready";
  const approvalChecklist = [
    "Approve source coverage and transcript completeness.",
    "Approve claim ledger statuses and final narration wording.",
    "Approve paid image/video/TTS generation spend.",
    "Approve thumbnail, title, description, and tags.",
    "Approve final upload or scheduling action.",
  ];

  pkg.qa = {
    ...pkg.qa,
    status,
    blockers,
    approval_required: true,
    warnings,
    fix_list: fixList,
    approval_checklist: approvalChecklist,
    publish_readiness: publishReadiness,
  } as ProductionPackage["qa"];

  const markdown = `# 08 QA

Generated deterministic QA packet from package data and production artifacts.

## QA Status

- Status: ${status}
- Publish readiness: ${publishReadiness}
- Approval required: true

## Blockers

${bulletList(blockers)}

## Warnings

${bulletList(warnings)}

## Fix List

${bulletList(fixList)}

## Approval Checklist

${approvalChecklist.map((item) => `- [ ] ${item}`).join("\n")}

## Coverage Snapshot

- Sources: ${pkg.sources.length}
- Missing transcripts: ${missingTranscriptCount}
- Supported claims: ${supported}
- Needs evidence: ${needsEvidence}
- High risk: ${highRisk}
- Do not use: ${doNotUse}
- Storyboard scenes: ${storyboardScenes}
- Image prompts: ${imagePrompts}
- Video prompts: ${videoPrompts}
- Asset manifest items: ${assetManifestItems}
- Title candidates: ${titleCount}

## Policy Notes

- Do not publish while blockers remain.
- Do not call paid generation, render, upload, or schedule adapters without explicit human approval.
- Keep source links, timestamps, model choices, and costs attached to the run before final publication.
`;

  await Promise.all([
    writeRunFile(runId, "08-qa.md", markdown),
    writeRunJson(runId, "production-package.json", pkg),
  ]);

  return {
    status,
    blockers: blockers.length,
    warnings: warnings.length,
    file: "08-qa.md",
  };
}
