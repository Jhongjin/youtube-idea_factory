import { readRunJson, writeRunFile, writeRunJson } from "@/lib/run-store";
import type { ProductionPackage } from "@/lib/runs";

type FeedbackInsightsArtifact = {
  recommendations?: string[];
  signals?: string[];
  status?: string;
};

type AbLearningArtifact = {
  variants?: Array<{
    content?: string;
    kind?: string;
    label?: string;
    status?: string;
  }>;
};

export type ChannelMemoryUpdate = {
  created_at: string;
  run_id: string;
  topic: string;
  status: "draft" | "ready";
  carry_forward: string[];
  caution_flags: string[];
  title_patterns: string[];
  thumbnail_patterns: string[];
  hook_patterns: string[];
  next_experiments: string[];
};

const memoryPath = "12-channel-memory-update.json";
const memoryMarkdownPath = "12-channel-memory-update.md";

function compact(value: string, max = 180) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => compact(value)).filter(Boolean))];
}

function titlePatterns(pkg: ProductionPackage, learningLog: AbLearningArtifact | null) {
  const fromLearningLog =
    learningLog?.variants
      ?.filter((variant) => variant.kind === "title")
      .map((variant) => variant.content ?? "") ?? [];
  return unique([...(pkg.publishing_package.title_candidates ?? []), ...fromLearningLog]).slice(0, 5);
}

function thumbnailPatterns(pkg: ProductionPackage, learningLog: AbLearningArtifact | null) {
  const fromLearningLog =
    learningLog?.variants
      ?.filter((variant) => variant.kind === "thumbnail")
      .map((variant) => variant.content ?? "") ?? [];
  return unique([pkg.publishing_package.thumbnail_prompt ?? "", ...fromLearningLog]).slice(0, 3);
}

function hookPatterns(pkg: ProductionPackage, learningLog: AbLearningArtifact | null) {
  const fromLearningLog =
    learningLog?.variants
      ?.filter((variant) => variant.kind === "hook")
      .map((variant) => variant.content ?? "") ?? [];
  return unique([pkg.script_plan.hook, ...fromLearningLog]).slice(0, 3);
}

function markdownFor(update: ChannelMemoryUpdate) {
  return [
    "# Channel Memory Update",
    "",
    `- Topic: ${update.topic}`,
    `- Status: ${update.status}`,
    `- Created at: ${update.created_at}`,
    "",
    "## Carry Forward",
    "",
    ...update.carry_forward.map((item) => `- ${item}`),
    "",
    "## Caution Flags",
    "",
    ...update.caution_flags.map((item) => `- ${item}`),
    "",
    "## Title Patterns",
    "",
    ...update.title_patterns.map((item) => `- ${item}`),
    "",
    "## Thumbnail Patterns",
    "",
    ...update.thumbnail_patterns.map((item) => `- ${item}`),
    "",
    "## Hook Patterns",
    "",
    ...update.hook_patterns.map((item) => `- ${item}`),
    "",
    "## Next Experiments",
    "",
    ...update.next_experiments.map((item) => `- ${item}`),
    "",
  ].join("\n");
}

export async function createChannelMemoryUpdate(runId: string) {
  const pkg = await readRunJson<ProductionPackage>(runId, "production-package.json");
  const [insights, learningLog] = await Promise.all([
    readRunJson<FeedbackInsightsArtifact>(runId, "10-feedback-insights.json").catch(() => null),
    readRunJson<AbLearningArtifact>(runId, "11-ab-learning-log.json").catch(() => null),
  ]);
  const now = new Date().toISOString();
  const titleItems = titlePatterns(pkg, learningLog);
  const thumbnailItems = thumbnailPatterns(pkg, learningLog);
  const hookItems = hookPatterns(pkg, learningLog);
  const carryForward = unique([
    ...(insights?.signals ?? []),
    ...(pkg.feedback_loop?.view_count ? [`Latest public view count: ${pkg.feedback_loop.view_count}`] : []),
    ...(pkg.brief.category ? [`Category: ${pkg.brief.category}`] : []),
  ]);
  const cautionFlags = unique([
    ...(insights?.recommendations ?? []),
    ...(pkg.qa.warnings ?? []),
    ...(pkg.qa.blockers ?? []),
  ]);
  const nextExperiments = unique([
    titleItems.length > 1 ? "Compare the strongest two title promises in the next upload." : "",
    thumbnailItems.length > 0 ? "Create one thumbnail variant with clearer focal contrast." : "",
    hookItems.length > 0 ? "Test a tighter first-sentence hook before the next storyboard draft." : "",
    "Collect at least two performance snapshots before promoting a pattern into global channel memory.",
  ]);
  const update: ChannelMemoryUpdate = {
    carry_forward: carryForward.length ? carryForward : ["No performance learning captured yet."],
    caution_flags: cautionFlags.length ? cautionFlags : ["No caution flags captured yet."],
    created_at: now,
    hook_patterns: hookItems,
    next_experiments: nextExperiments,
    run_id: runId,
    status: insights || learningLog ? "ready" : "draft",
    thumbnail_patterns: thumbnailItems,
    title_patterns: titleItems,
    topic: pkg.brief.topic,
  };

  pkg.channel_memory_update = {
    items:
      update.carry_forward.length +
      update.caution_flags.length +
      update.title_patterns.length +
      update.thumbnail_patterns.length +
      update.hook_patterns.length +
      update.next_experiments.length,
    path: memoryPath,
    status: update.status,
    updated_at: now,
  };

  await Promise.all([
    writeRunJson(runId, memoryPath, update),
    writeRunFile(runId, memoryMarkdownPath, markdownFor(update)),
    writeRunJson(runId, "production-package.json", pkg),
  ]);

  return update;
}
