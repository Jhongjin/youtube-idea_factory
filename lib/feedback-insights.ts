import { readRunJson, writeRunFile, writeRunJson } from "@/lib/run-store";
import type { ProductionPackage } from "@/lib/runs";
import type { PerformanceSnapshot } from "@/lib/youtube-performance";

export type FeedbackInsightStatus = "needs_more_data" | "watch" | "learning" | "strong_signal";

export type FeedbackInsights = {
  created_at: string;
  status: FeedbackInsightStatus;
  video_id: string;
  snapshot_count: number;
  first_snapshot_at: string;
  latest_snapshot_at: string;
  elapsed_hours: number;
  metrics: {
    comment_rate: number;
    engagement_rate: number;
    like_rate: number;
    view_delta: number;
    view_velocity_per_hour: number | null;
    views: number;
  };
  source_benchmark: {
    max_view_count: number;
    median_view_count: number;
    source_count: number;
    view_vs_median_ratio: number | null;
  };
  signals: string[];
  recommendations: string[];
};

type PerformanceHistory = {
  snapshots?: PerformanceSnapshot[];
};

const historyPath = "09-performance-history.json";
const insightsPath = "10-feedback-insights.json";
const insightsMarkdownPath = "10-feedback-insights.md";

function numeric(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function round(value: number, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function sortedSnapshots(history: PerformanceHistory) {
  return [...(history.snapshots ?? [])].sort((a, b) => a.fetched_at.localeCompare(b.fetched_at));
}

function median(values: number[]) {
  const sorted = values.filter((value) => value > 0).sort((a, b) => a - b);
  if (sorted.length === 0) {
    return 0;
  }
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function elapsedHours(first: string, latest: string) {
  const deltaMs = Date.parse(latest) - Date.parse(first);
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
    return 0;
  }
  return round(deltaMs / 3_600_000, 2);
}

function statusFor({
  elapsed,
  engagementRate,
  snapshotCount,
  viewDelta,
}: {
  elapsed: number;
  engagementRate: number;
  snapshotCount: number;
  viewDelta: number;
}): FeedbackInsightStatus {
  if (snapshotCount < 2 || elapsed < 1) {
    return "needs_more_data";
  }
  if (viewDelta <= 0 || engagementRate < 0.005) {
    return "watch";
  }
  if (engagementRate >= 0.03 && viewDelta > 0) {
    return "strong_signal";
  }
  return "learning";
}

function sourceBenchmark(pkg: ProductionPackage, views: number) {
  const counts = pkg.sources.map((source) => numeric(source.view_count ?? 0)).filter((value) => value > 0);
  const medianViewCount = median(counts);
  return {
    max_view_count: counts.length ? Math.max(...counts) : 0,
    median_view_count: Math.round(medianViewCount),
    source_count: counts.length,
    view_vs_median_ratio: medianViewCount > 0 ? round(views / medianViewCount, 4) : null,
  };
}

function buildSignals(insights: FeedbackInsights) {
  const signals: string[] = [];
  if (insights.snapshot_count < 2) {
    signals.push("At least one more snapshot is needed to measure growth velocity.");
  }
  if (insights.metrics.view_velocity_per_hour !== null) {
    signals.push(`View velocity is ${insights.metrics.view_velocity_per_hour} views/hour.`);
  }
  signals.push(`Engagement rate is ${(insights.metrics.engagement_rate * 100).toFixed(2)}%.`);
  if (insights.source_benchmark.view_vs_median_ratio !== null) {
    signals.push(
      `Current views are ${(insights.source_benchmark.view_vs_median_ratio * 100).toFixed(1)}% of the source median.`,
    );
  }
  return signals;
}

function buildRecommendations(pkg: ProductionPackage, insights: FeedbackInsights) {
  const recommendations: string[] = [];
  if (insights.status === "needs_more_data") {
    recommendations.push("Take another performance snapshot after a meaningful interval, ideally 6 to 24 hours.");
  }
  if (insights.status === "watch") {
    recommendations.push("Review the first 10 seconds, title promise, and thumbnail clarity before scaling the format.");
  }
  if (insights.metrics.like_rate > 0 && insights.metrics.like_rate < 0.01) {
    recommendations.push("Like rate is low; strengthen emotional payoff or viewer identity framing in the script.");
  }
  if (insights.metrics.comment_rate < 0.001) {
    recommendations.push("Add a sharper comment prompt or a clear either/or question in the outro.");
  }
  if (
    insights.source_benchmark.view_vs_median_ratio !== null &&
    insights.source_benchmark.view_vs_median_ratio < 0.1
  ) {
    recommendations.push("Source benchmark gap is large; re-check topic timing, search intent, and thumbnail contrast.");
  }
  if (pkg.script_plan.hook) {
    recommendations.push(`Carry forward or revise hook hypothesis: ${pkg.script_plan.hook.slice(0, 160)}`);
  }
  if (recommendations.length === 0) {
    recommendations.push("Keep collecting snapshots and compare the next title/thumbnail variant against this baseline.");
  }
  return recommendations;
}

function markdownFor(pkg: ProductionPackage, insights: FeedbackInsights) {
  return [
    "# Feedback Insights",
    "",
    `- Topic: ${pkg.brief.topic}`,
    `- Video ID: ${insights.video_id}`,
    `- Status: ${insights.status}`,
    `- Snapshot count: ${insights.snapshot_count}`,
    `- Window: ${insights.first_snapshot_at} to ${insights.latest_snapshot_at}`,
    "",
    "## Metrics",
    "",
    `- Views: ${insights.metrics.views}`,
    `- View delta: ${insights.metrics.view_delta}`,
    `- View velocity/hour: ${insights.metrics.view_velocity_per_hour ?? "not enough time"}`,
    `- Like rate: ${(insights.metrics.like_rate * 100).toFixed(2)}%`,
    `- Comment rate: ${(insights.metrics.comment_rate * 100).toFixed(2)}%`,
    `- Engagement rate: ${(insights.metrics.engagement_rate * 100).toFixed(2)}%`,
    "",
    "## Source Benchmark",
    "",
    `- Source count: ${insights.source_benchmark.source_count}`,
    `- Source median views: ${insights.source_benchmark.median_view_count}`,
    `- Source max views: ${insights.source_benchmark.max_view_count}`,
    `- Current/source median ratio: ${insights.source_benchmark.view_vs_median_ratio ?? "n/a"}`,
    "",
    "## Signals",
    "",
    ...insights.signals.map((signal) => `- ${signal}`),
    "",
    "## Recommendations",
    "",
    ...insights.recommendations.map((recommendation) => `- ${recommendation}`),
    "",
  ].join("\n");
}

export async function createFeedbackInsights(runId: string) {
  const [pkg, history] = await Promise.all([
    readRunJson<ProductionPackage>(runId, "production-package.json"),
    readRunJson<PerformanceHistory>(runId, historyPath),
  ]);
  const snapshots = sortedSnapshots(history);
  if (snapshots.length === 0) {
    throw new Error("No performance snapshots found. Create a performance snapshot first.");
  }

  const first = snapshots[0];
  const latest = snapshots[snapshots.length - 1];
  const elapsed = elapsedHours(first.fetched_at, latest.fetched_at);
  const views = numeric(latest.statistics.view_count);
  const likes = numeric(latest.statistics.like_count);
  const comments = numeric(latest.statistics.comment_count);
  const viewDelta = views - numeric(first.statistics.view_count);
  const likeRate = round(ratio(likes, views), 5);
  const commentRate = round(ratio(comments, views), 5);
  const engagementRate = round(ratio(likes + comments, views), 5);
  const viewVelocityPerHour = elapsed > 0 ? round(viewDelta / elapsed, 2) : null;
  const benchmark = sourceBenchmark(pkg, views);
  const now = new Date().toISOString();
  const baseInsights: FeedbackInsights = {
    created_at: now,
    elapsed_hours: elapsed,
    first_snapshot_at: first.fetched_at,
    latest_snapshot_at: latest.fetched_at,
    metrics: {
      comment_rate: commentRate,
      engagement_rate: engagementRate,
      like_rate: likeRate,
      view_delta: viewDelta,
      view_velocity_per_hour: viewVelocityPerHour,
      views,
    },
    recommendations: [],
    signals: [],
    snapshot_count: snapshots.length,
    source_benchmark: benchmark,
    status: statusFor({
      elapsed,
      engagementRate,
      snapshotCount: snapshots.length,
      viewDelta,
    }),
    video_id: latest.video_id,
  };
  const insights = {
    ...baseInsights,
    signals: buildSignals(baseInsights),
  };
  insights.recommendations = buildRecommendations(pkg, insights);

  pkg.feedback_insights = {
    path: insightsPath,
    recommendations: insights.recommendations.length,
    status: insights.status,
    updated_at: now,
  };

  await Promise.all([
    writeRunJson(runId, insightsPath, insights),
    writeRunFile(runId, insightsMarkdownPath, markdownFor(pkg, insights)),
    writeRunJson(runId, "production-package.json", pkg),
  ]);

  return insights;
}
