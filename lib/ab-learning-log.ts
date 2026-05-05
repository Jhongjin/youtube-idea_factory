import { readRunJson, writeRunFile, writeRunJson } from "@/lib/run-store";
import type { ProductionPackage } from "@/lib/runs";

export type AbLearningVariant = {
  id: string;
  kind: "title" | "thumbnail" | "hook";
  label: string;
  hypothesis: string;
  content: string;
  status: "candidate" | "baseline" | "winner" | "archived";
  metrics: {
    ctr?: number;
    engagement_rate?: number;
    view_count?: number;
    view_velocity_per_hour?: number | null;
  };
};

export type AbLearningLog = {
  created_at: string;
  status: "draft" | "needs_metrics" | "ready_for_comparison";
  run_id: string;
  topic: string;
  baseline: {
    feedback_status?: string;
    latest_views?: number;
    recommendations?: number;
  };
  variants: AbLearningVariant[];
  measurement_plan: string[];
  next_actions: string[];
};

const logPath = "11-ab-learning-log.json";
const logMarkdownPath = "11-ab-learning-log.md";

function slugPart(value: string, fallback: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 28) || fallback
  );
}

function titleVariants(pkg: ProductionPackage): AbLearningVariant[] {
  const titles = pkg.publishing_package.title_candidates ?? [];
  return titles.slice(0, 5).map((title, index) => ({
    content: title,
    hypothesis: "Title promise and curiosity framing will affect click intent.",
    id: `title-${index + 1}-${slugPart(title, "candidate")}`,
    kind: "title",
    label: `Title ${index + 1}`,
    metrics: {},
    status: index === 0 ? "baseline" : "candidate",
  }));
}

function thumbnailVariant(pkg: ProductionPackage): AbLearningVariant[] {
  const prompt = pkg.publishing_package.thumbnail_prompt?.trim();
  if (!prompt) {
    return [];
  }
  return [
    {
      content: prompt,
      hypothesis: "Thumbnail clarity, contrast, and emotional focus will affect CTR.",
      id: "thumbnail-1-baseline",
      kind: "thumbnail",
      label: "Thumbnail 1",
      metrics: {},
      status: "baseline",
    },
  ];
}

function hookVariant(pkg: ProductionPackage): AbLearningVariant[] {
  const hook = pkg.script_plan.hook?.trim();
  if (!hook) {
    return [];
  }
  return [
    {
      content: hook,
      hypothesis: "Opening hook specificity and payoff tension will affect early retention.",
      id: "hook-1-baseline",
      kind: "hook",
      label: "Hook 1",
      metrics: {},
      status: "baseline",
    },
  ];
}

function markdownFor(log: AbLearningLog) {
  return [
    "# A/B Learning Log",
    "",
    `- Topic: ${log.topic}`,
    `- Status: ${log.status}`,
    `- Created at: ${log.created_at}`,
    `- Latest views: ${log.baseline.latest_views ?? "n/a"}`,
    `- Feedback status: ${log.baseline.feedback_status ?? "n/a"}`,
    "",
    "## Variants",
    "",
    ...log.variants.flatMap((variant) => [
      `### ${variant.label}`,
      "",
      `- Kind: ${variant.kind}`,
      `- Status: ${variant.status}`,
      `- Hypothesis: ${variant.hypothesis}`,
      `- Content: ${variant.content}`,
      "",
    ]),
    "## Measurement Plan",
    "",
    ...log.measurement_plan.map((item) => `- ${item}`),
    "",
    "## Next Actions",
    "",
    ...log.next_actions.map((item) => `- ${item}`),
    "",
  ].join("\n");
}

export async function createAbLearningLog(runId: string) {
  const pkg = await readRunJson<ProductionPackage>(runId, "production-package.json");
  const now = new Date().toISOString();
  const variants = [...titleVariants(pkg), ...thumbnailVariant(pkg), ...hookVariant(pkg)];
  const log: AbLearningLog = {
    baseline: {
      feedback_status: pkg.feedback_insights?.status,
      latest_views: pkg.feedback_loop?.view_count,
      recommendations: pkg.feedback_insights?.recommendations,
    },
    created_at: now,
    measurement_plan: [
      "Use YouTube Analytics CTR and average view duration once the analytics OAuth adapter exists.",
      "Until then, compare public view velocity and engagement rate from repeated performance snapshots.",
      "Keep variants mutually exclusive: change title, thumbnail, or hook one at a time.",
    ],
    next_actions: [
      "Collect at least two performance snapshots before declaring a winner.",
      "Record the exact title and thumbnail used when publishing or changing metadata.",
      "Promote only variants with better click intent and no drop in engagement quality.",
    ],
    run_id: runId,
    status: variants.length > 0 ? "needs_metrics" : "draft",
    topic: pkg.brief.topic,
    variants,
  };

  pkg.learning_log = {
    path: logPath,
    status: log.status,
    updated_at: now,
    variants: variants.length,
  };

  await Promise.all([
    writeRunJson(runId, logPath, log),
    writeRunFile(runId, logMarkdownPath, markdownFor(log)),
    writeRunJson(runId, "production-package.json", pkg),
  ]);

  return log;
}
