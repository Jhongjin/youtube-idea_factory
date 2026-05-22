import { readRunFileIfExists, readRunJson, writeRunFile, writeRunJson } from "@/lib/run-store";
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

function scenePlanFor(duration: number) {
  if (duration > 180) {
    const bodyEnd = Math.max(60, duration - 120);
    return [
      {
        asset_needs: ["text card", "generated image/video", "subtitle"],
        duration_seconds: 15,
        edit_notes: "Open with contrast and motion. Do not mirror competitor openings.",
        narration: "Hook: state the viewer tension and promise.",
        on_screen_text: "One short curiosity line.",
        prompt_needed: true,
        risk_notes: "Keep the promise source-backed and avoid unsupported claims.",
        scene_id: "S01",
        time_range: "0-15s",
        visual: "Fast contrast visual or source-pattern montage.",
      },
      {
        asset_needs: ["text card", "simple icon", "subtitle"],
        duration_seconds: 45,
        edit_notes: "Use a calm setup before the first evidence beat.",
        narration: "Context: explain why this topic matters now.",
        on_screen_text: "Why it matters",
        prompt_needed: false,
        risk_notes: "Tie factual context to the claim ledger.",
        scene_id: "S02",
        time_range: "15-60s",
        visual: "Clean topic context card with source/category cues.",
      },
      {
        asset_needs: ["diagram", "source-free B-roll", "subtitle"],
        duration_seconds: 120,
        edit_notes: "Show the repeated pattern without copying source visuals.",
        narration: "Pattern overview: summarize what the winning source set repeats.",
        on_screen_text: "Repeated pattern",
        prompt_needed: true,
        risk_notes: "No competitor thumbnails, exact titles, or scene order.",
        scene_id: "S03",
        time_range: "60-180s",
        visual: "Three-part diagram of hook, tension, and payoff patterns.",
      },
      {
        asset_needs: ["text card", "chart-like card", "subtitle"],
        duration_seconds: 180,
        edit_notes: "Alternate narration with short retention checkpoints.",
        narration: "Viewer problem: connect the pattern to the target audience's real question.",
        on_screen_text: "The viewer problem",
        prompt_needed: false,
        risk_notes: "Keep audience assumptions framed as strategy, not fact.",
        scene_id: "S04",
        time_range: "180-360s",
        visual: "Problem ladder that moves from surface concern to core tension.",
      },
      {
        asset_needs: ["generated B-roll", "diagram", "subtitle"],
        duration_seconds: 240,
        edit_notes: "Use chapters or numbered beats to sustain a longform rhythm.",
        narration: "Main analysis: deliver the strongest mechanism or explanation.",
        on_screen_text: "Main mechanism",
        prompt_needed: true,
        risk_notes: "Do not turn needs_evidence rows into factual narration.",
        scene_id: "S05",
        time_range: "360-600s",
        visual: "Step-by-step visual metaphor or mini diagram.",
      },
      {
        asset_needs: ["evidence cards", "simple table", "subtitle"],
        duration_seconds: 240,
        edit_notes: "Pause for claim status and evidence separation.",
        narration: "Proof/check: separate verified facts, interpretation, and open questions.",
        on_screen_text: "Verified vs. needs checking",
        prompt_needed: false,
        risk_notes: "Unsupported claims must remain flagged or be reframed.",
        scene_id: "S06",
        time_range: "600-840s",
        visual: "Evidence cards or claim status checklist.",
      },
      {
        asset_needs: ["text cards", "B-roll", "subtitle"],
        duration_seconds: bodyEnd - 840,
        edit_notes: "Convert analysis into a usable viewer takeaway.",
        narration: "Application: show what the viewer can do with the insight.",
        on_screen_text: "What to do next",
        prompt_needed: true,
        risk_notes: "Avoid prescriptive advice beyond the evidence level.",
        scene_id: "S07",
        time_range: `840-${bodyEnd}s`,
        visual: "Practical checklist or decision path.",
      },
      {
        asset_needs: ["text card", "brand-safe outro", "subtitle"],
        duration_seconds: duration - bodyEnd,
        edit_notes: "End with one takeaway and restrained CTA.",
        narration: "Payoff: recap the practical takeaway and close with a CTA.",
        on_screen_text: "Takeaway",
        prompt_needed: false,
        risk_notes: "CTA should match channel strategy.",
        scene_id: "S08",
        time_range: `${bodyEnd}-${duration}s`,
        visual: "Final concise text card with channel-style ending.",
      },
    ];
  }

  return [
    {
      asset_needs: ["generated image/video", "subtitle"],
      duration_seconds: 5,
      edit_notes: "Do not copy competitor thumbnails or exact opening.",
      narration: "Hook: state the viewer tension and promise.",
      on_screen_text: "One short curiosity line.",
      prompt_needed: true,
      risk_notes: "Keep factual hooks supported by the claim ledger.",
      scene_id: "S01",
      time_range: "0-5s",
      visual: "Fast contrast visual or source-pattern montage.",
    },
    {
      asset_needs: ["text card", "simple icon", "subtitle"],
      duration_seconds: 10,
      edit_notes: "Keep factual claims tied to claim ledger.",
      narration: "Context: explain why this topic matters now.",
      on_screen_text: "Why it matters",
      prompt_needed: false,
      risk_notes: "Do not invent evidence.",
      scene_id: "S02",
      time_range: "5-15s",
      visual: "Clean topic context card with source/category cues.",
    },
    {
      asset_needs: ["generated B-roll", "diagram", "captions"],
      duration_seconds: 20,
      edit_notes: "Use analysis notes as source of patterns.",
      narration: "Main insight: deliver the strongest mechanism or pattern.",
      on_screen_text: "Pattern / Mechanism",
      prompt_needed: true,
      risk_notes: "Do not preserve competitor scene order.",
      scene_id: "S03",
      time_range: "15-35s",
      visual: "Step-by-step visual metaphor or mini diagram.",
    },
    {
      asset_needs: ["evidence cards", "simple table", "subtitle"],
      duration_seconds: Math.max(10, duration - 45),
      edit_notes: "Avoid unsupported claims.",
      narration: "Proof/check: separate verified facts from assumptions.",
      on_screen_text: "Verified vs. needs checking",
      prompt_needed: false,
      risk_notes: "Unsupported claims must remain flagged.",
      scene_id: "S04",
      time_range: `35-${Math.max(45, duration - 10)}s`,
      visual: "Evidence cards or claim status checklist.",
    },
    {
      asset_needs: ["text card", "brand-safe outro", "subtitle"],
      duration_seconds: 10,
      edit_notes: "CTA should match channel strategy.",
      narration: "Payoff: give the viewer one practical takeaway and CTA.",
      on_screen_text: "Takeaway",
      prompt_needed: false,
      risk_notes: "Keep the ending within approved claims.",
      scene_id: "S05",
      time_range: `${Math.max(45, duration - 10)}-${duration}s`,
      visual: "Final concise text card with channel-style ending.",
    },
  ];
}

function formatSceneRows(scenes: ReturnType<typeof scenePlanFor>) {
  return scenes
    .map(
      (row) =>
        `| ${row.scene_id} | ${row.time_range} | ${row.narration} | ${row.visual} | ${row.on_screen_text} | ${row.asset_needs.join(", ")} | ${row.edit_notes} ${row.risk_notes} |`,
    )
    .join("\n");
}

export async function createStoryboardDraft(runId: string): Promise<StoryboardDraftResult> {
  assertSafeRunId(runId);
  const pkg = await readRunJson<ProductionPackage>(runId, "production-package.json");
  const script = (await readRunFileIfExists(runId, "04-script-plan.md")) ?? "";
  const duration = pkg.brief.target_duration_seconds ?? 60;
  const scenes = scenePlanFor(duration);

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
${formatSceneRows(scenes)}

## Asset Summary

- Generated image/video candidates: S01, S03
- Text/data cards: S02, S04, S05
- Human approval needed before paid generation.

## Generation Priority

1. S01 hook visual
2. S03 main insight visual
3. S04 evidence/check visual
`;
  const generatedAt = new Date().toISOString();
  pkg.storyboard = scenes;
  pkg.script_plan = {
    ...pkg.script_plan,
    notes: `${pkg.script_plan.notes ?? ""}\nStoryboard draft generated at ${generatedAt} with ${scenes.length} scenes. Human review required before media prompts and paid generation.`.trim(),
  };

  await Promise.all([
    writeRunFile(runId, "05-storyboard.md", markdown),
    writeRunJson(runId, "production-package.json", pkg),
  ]);

  return {
    scenes: scenes.length,
    file: "05-storyboard.md",
  };
}
