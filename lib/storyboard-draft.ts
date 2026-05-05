import { readRunFileIfExists, readRunJson, writeRunFile } from "@/lib/run-store";
import type { ProductionPackage } from "@/lib/runs";

export type StoryboardDraftResult = {
  scenes: number;
  file: string;
};

function assertSafeRunId(runId: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error("Invalid run id.");
  }
}

function formatSceneRows(duration: number) {
  const scenePlan = [
    {
      scene: "S01",
      time: "0-5s",
      narration: "Hook: state the viewer tension and promise.",
      visual: "Fast contrast visual or source-pattern montage.",
      text: "One short curiosity line.",
      assets: "Generated image/video or edited source-free montage",
      notes: "Do not copy competitor thumbnails or exact opening.",
    },
    {
      scene: "S02",
      time: "5-15s",
      narration: "Context: explain why this topic matters now.",
      visual: "Clean topic context card with source/category cues.",
      text: "Why it matters",
      assets: "Text card, simple icon, data card",
      notes: "Keep factual claims tied to claim ledger.",
    },
    {
      scene: "S03",
      time: "15-35s",
      narration: "Main insight: deliver the strongest mechanism or pattern.",
      visual: "Step-by-step visual metaphor or mini diagram.",
      text: "Pattern / Mechanism",
      assets: "Generated B-roll, diagram, captions",
      notes: "Use analysis notes as source of patterns.",
    },
    {
      scene: "S04",
      time: `35-${Math.max(45, duration - 10)}s`,
      narration: "Proof/check: separate verified facts from assumptions.",
      visual: "Evidence cards or claim status checklist.",
      text: "Verified vs. needs checking",
      assets: "Evidence cards, simple table",
      notes: "Avoid unsupported claims.",
    },
    {
      scene: "S05",
      time: `${Math.max(45, duration - 10)}-${duration}s`,
      narration: "Payoff: give the viewer one practical takeaway and CTA.",
      visual: "Final concise text card with channel-style ending.",
      text: "Takeaway",
      assets: "Text card, logo/brand-safe outro",
      notes: "CTA should match channel strategy.",
    },
  ];

  return scenePlan
    .map(
      (row) =>
        `| ${row.scene} | ${row.time} | ${row.narration} | ${row.visual} | ${row.text} | ${row.assets} | ${row.notes} |`,
    )
    .join("\n");
}

export async function createStoryboardDraft(runId: string): Promise<StoryboardDraftResult> {
  assertSafeRunId(runId);
  const pkg = await readRunJson<ProductionPackage>(runId, "production-package.json");
  const script = (await readRunFileIfExists(runId, "04-script-plan.md")) ?? "";
  const duration = pkg.brief.target_duration_seconds ?? 60;

  const markdown = `# 05 Storyboard

Generated deterministic starter storyboard from the current script plan.

## Production Context

- Topic: ${pkg.brief.topic}
- Format: ${pkg.brief.format}
- Target duration: ${duration} seconds
- Language: ${pkg.brief.language}

## Source Script Snapshot

${script.slice(0, 1800)}

## Scene Cards

| Scene | Time | Narration | Visual | On-Screen Text | Asset Needs | Notes |
| --- | --- | --- | --- | --- | --- | --- |
${formatSceneRows(duration)}

## Asset Summary

- Generated image/video candidates: S01, S03
- Text/data cards: S02, S04, S05
- Human approval needed before paid generation.

## Generation Priority

1. S01 hook visual
2. S03 main insight visual
3. S04 evidence/check visual
`;

  await writeRunFile(runId, "05-storyboard.md", markdown);

  return {
    scenes: 5,
    file: "05-storyboard.md",
  };
}
