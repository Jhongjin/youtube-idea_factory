import { getYouTubeChannel } from "@/lib/channels";
import { createRunWorkspace } from "@/lib/run-store";
import type { ProductionPackage, ProductionRunChannel, SourceVideo } from "@/lib/runs";
import type { YouTubeCandidate } from "@/lib/youtube-finder";
import { extractYouTubeVideoId } from "@/lib/youtube-url";

export type CreateRunInput = {
  topic: string;
  category?: string;
  categoryId?: string;
  candidateLimit?: number;
  channelId?: string;
  format?: string;
  language?: string;
  lookbackDays?: number;
  regionCode?: string;
  sourceCandidates?: YouTubeCandidate[];
  sourceMode?: "manual" | "categoryTop" | "topicSearch";
  targetAudience?: string;
  tone?: string;
  durationSeconds?: number;
  seedUrls: string[];
};

type NormalizedCreateRunInput = {
  category: string;
  categoryId: string;
  candidateLimit: number;
  channelId: string;
  durationSeconds: number;
  format: string;
  language: string;
  lookbackDays: number;
  regionCode: string;
  seedUrls: string[];
  sourceCandidates: YouTubeCandidate[];
  sourceMode: "manual" | "categoryTop" | "topicSearch";
  targetAudience: string;
  tone: string;
  topic: string;
};

function slugify(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (slug || "run").slice(0, 48);
}

function markdownTable(headers: string[], rows: string[][]) {
  const lines = [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
  ];

  for (const row of rows) {
    lines.push(`| ${row.map((cell) => cell.replace(/\n/g, " ").replace(/\|/g, "\\|")).join(" | ")} |`);
  }

  return lines.join("\n");
}

function buildSource(seedUrl: string, index: number): SourceVideo {
  const videoId = extractYouTubeVideoId(seedUrl);
  return {
    rank: index,
    url: seedUrl,
    title: `Manual seed ${index}: ${videoId || seedUrl}`,
    channel: "",
    inclusion_reason: "Manual seed URL provided during intake.",
    transcript_status: "not_checked",
    video_id: videoId,
  };
}

function sourceModeLabel(sourceMode: NormalizedCreateRunInput["sourceMode"]) {
  if (sourceMode === "topicSearch") {
    return "topic_search";
  }
  if (sourceMode === "categoryTop") {
    return "category_top";
  }
  return "manual_seed";
}

function clampPositiveInt(value: number | undefined, fallback: number, max: number) {
  const parsed = Number.isFinite(value) ? value ?? fallback : fallback;
  return Math.max(1, Math.min(max, Math.floor(parsed)));
}

function buildSourceFromCandidate(
  candidate: YouTubeCandidate,
  index: number,
  sourceMode: NormalizedCreateRunInput["sourceMode"],
): SourceVideo {
  return {
    rank: index,
    url: candidate.url,
    title: candidate.title || `YouTube candidate ${index}: ${candidate.videoId}`,
    channel: candidate.channel,
    channel_id: candidate.channelId,
    comment_count: candidate.commentCount,
    description: candidate.description,
    duration: candidate.duration,
    duration_seconds: candidate.durationSeconds,
    inclusion_reason:
      sourceMode === "topicSearch"
        ? `Selected from YouTube topic search intake using recency, view count, format match, and channel diversity.${candidate.searchScope ? ` Scope: ${candidate.searchScope}.` : ""}`
        : `Selected from YouTube category intake using recency, view count, format match, and channel diversity.${candidate.searchScope ? ` Scope: ${candidate.searchScope}.` : ""}`,
    like_count: candidate.likeCount,
    metadata_status: "youtube_data_api",
    published_at: candidate.publishedAt,
    search_published_after: candidate.searchPublishedAfter,
    search_query: candidate.searchQuery,
    search_scope: candidate.searchScope,
    source_mode: sourceModeLabel(sourceMode),
    thumbnail_url: candidate.thumbnailUrl,
    transcript_status: "not_checked",
    video_id: candidate.videoId,
    view_count: candidate.viewCount,
  };
}

function buildPackage(
  input: NormalizedCreateRunInput,
  runId: string,
  sources: SourceVideo[],
  channel?: ProductionRunChannel,
) {
  const pkg: ProductionPackage = {
    run_id: runId,
    brief: {
      topic: input.topic,
      category: input.category,
      category_id: input.categoryId,
      ...(channel ? { channel } : {}),
      format: input.format,
      target_audience: input.targetAudience,
      target_duration_seconds: input.durationSeconds,
      language: input.language,
      region_code: input.regionCode,
      source_mode: input.sourceMode,
      source_candidate_limit: input.candidateLimit,
      source_lookback_days: input.lookbackDays,
      tone: input.tone,
    },
    sources,
    claim_ledger: [],
    script_plan: {
      angle: "Needs strategy selection after research and analysis.",
      hook: "Needs hook drafting after competitor analysis.",
      outline: [
        "Research intake created.",
        "Analyze seed videos.",
        "Fact-check claims.",
        "Draft source-backed script plan.",
      ],
      notes:
        input.sourceMode === "categoryTop"
          ? "Generated by dashboard category top-video bootstrap. Fill with youtube-script-architect after research and fact-checking."
          : input.sourceMode === "topicSearch"
            ? "Generated by dashboard topic-search bootstrap. Fill with youtube-script-architect after research and fact-checking."
            : "Generated by dashboard manual-seed bootstrap. Fill with youtube-script-architect after research and fact-checking.",
    },
    storyboard: [],
    media_prompts: {
      style_bible: "",
      image_prompts: [],
      video_prompts: [],
    },
    publishing_package: {
      title_candidates: [],
      description: "",
      tags: [],
      thumbnail_prompt: "",
    },
    qa: {
      status: "needs_review",
      blockers: [
        "Competitor video analysis is not complete.",
        "Claim ledger is empty.",
        "Script plan is only a bootstrap placeholder.",
        "Storyboard and media prompts are not complete.",
        "Human approval is required before generation or publishing.",
      ],
      approval_required: true,
    },
  };

  return pkg;
}

function jsonContent(payload: unknown) {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

function buildMarkdownFiles(pkg: ProductionPackage): Record<string, string> {
  const brief = pkg.brief;
  const channelLabel = brief.channel
    ? `${brief.channel.brand_name} / ${brief.channel.channel_name}`
    : "";
  const sourceTable = markdownTable(
    ["Rank", "URL", "Video ID", "Working Title", "Reason", "Transcript"],
    pkg.sources.map((source, index) => [
      String(source.rank ?? index + 1),
      source.url,
      source.video_id ?? "",
      source.title,
      source.inclusion_reason,
      source.transcript_status ?? "not_checked",
    ]),
  );

  const files: Record<string, string> = {
    "README.md": `# Run ${pkg.run_id}

## Brief

- Topic: ${brief.topic}
- Category: ${brief.category ?? ""}
- Channel: ${channelLabel}
- Format: ${brief.format}
- Target audience: ${brief.target_audience ?? ""}
- Target duration: ${brief.target_duration_seconds ?? ""} seconds
- Language: ${brief.language}
- Region: ${brief.region_code ?? ""}
- Source lookback: ${brief.source_lookback_days ?? ""} days
- Source candidate limit: ${brief.source_candidate_limit ?? ""} videos
- Tone: ${brief.tone ?? ""}

## Stage Checklist

- [x] Intake created
- [ ] Research enriched
- [ ] Source video analysis complete
- [ ] Fact-check complete
- [ ] Script plan approved
- [ ] Storyboard approved
- [ ] Media prompts approved
- [ ] Generation approved
- [ ] Publishing package approved
`,
    "01-research.md": `# 01 Research

## Source Videos

${sourceTable}

## Research Summary

Pending.

## Patterns To Investigate

- Opening hooks
- Thumbnail/title promise
- Retention devices
- Repeated claims
- Viewer payoff
`,
  };

  const placeholders: Array<[string, string]> = [
    ["02-video-analysis.md", "# 02 Video Analysis\n\nPending.\n"],
    [
      "03-claim-ledger.md",
      "# 03 Claim Ledger\n\n| Claim | Status | Evidence URL | Confidence | Action |\n| --- | --- | --- | --- | --- |\n",
    ],
    ["04-script-plan.md", "# 04 Script Plan\n\nPending.\n"],
    [
      "05-storyboard.md",
      "# 05 Storyboard\n\n| Scene | Time | Narration | Visual | On-Screen Text | Asset Needs | Notes |\n| --- | --- | --- | --- | --- | --- | --- |\n",
    ],
    ["06-media-prompts.md", "# 06 Media Prompts\n\nPending.\n"],
    ["07-publishing-package.md", "# 07 Publishing Package\n\nPending.\n"],
    ["08-qa.md", "# 08 QA\n\n## QA Status\n\nneeds_review\n"],
  ];

  for (const [filename, content] of placeholders) {
    files[filename] = content;
  }

  return files;
}

export async function createRun(input: CreateRunInput) {
  const normalized: NormalizedCreateRunInput = {
    topic:
      (input.topic?.trim() ?? "") ||
      (input.sourceMode === "categoryTop"
        ? `${input.category?.trim() || "YouTube category"} ${input.format === "longform" ? "롱폼" : "쇼츠"} 리서치`
        : ""),
    category: input.category?.trim() ?? "",
    categoryId: input.categoryId?.trim() ?? "",
    candidateLimit: clampPositiveInt(input.candidateLimit, 10, 10),
    channelId: input.channelId?.trim() ?? "",
    format: input.format?.trim() || "shorts",
    language: input.language?.trim() || "ko",
    lookbackDays: clampPositiveInt(input.lookbackDays, 7, 30),
    regionCode: input.regionCode?.trim().toUpperCase() || "KR",
    sourceCandidates: (input.sourceCandidates ?? []).filter((candidate) => Boolean(candidate.url)),
    sourceMode:
      input.sourceMode === "categoryTop"
        ? "categoryTop"
        : input.sourceMode === "topicSearch"
          ? "topicSearch"
          : "manual",
    targetAudience: input.targetAudience?.trim() ?? "",
    tone: input.tone?.trim() ?? "",
    durationSeconds: input.durationSeconds && input.durationSeconds > 0 ? input.durationSeconds : 60,
    seedUrls: input.seedUrls.map((url) => url.trim()).filter(Boolean),
  };

  if (!normalized.topic && normalized.sourceMode === "topicSearch") {
    throw new Error("아이디어 직접 작성 모드에서는 영상 주제나 리서치 키워드가 필요합니다.");
  }
  if (normalized.seedUrls.length === 0 && normalized.sourceCandidates.length === 0) {
    throw new Error("소스 URL을 입력하거나 카테고리 TOP 10 후보를 먼저 가져와야 합니다.");
  }

  const now = new Date();
  const timestamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "-",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
  const runId = `${timestamp}-${slugify(normalized.topic)}`;
  const sources =
    normalized.sourceCandidates.length > 0
      ? normalized.sourceCandidates.map((candidate, index) =>
          buildSourceFromCandidate(candidate, index + 1, normalized.sourceMode),
        )
      : normalized.seedUrls.map((url, index) => buildSource(url, index + 1));
  const selectedChannel = normalized.channelId ? await getYouTubeChannel(normalized.channelId) : null;
  if (normalized.channelId && !selectedChannel) {
    throw new Error("선택한 브랜드 채널을 찾을 수 없습니다.");
  }
  if (selectedChannel?.status === "paused") {
    throw new Error("일시중지된 브랜드 채널로는 새 실행을 만들 수 없습니다.");
  }
  const channel = selectedChannel
    ? {
        brand_name: selectedChannel.brand_name,
        channel_id: selectedChannel.channel_id ?? null,
        channel_name: selectedChannel.channel_name,
        default_language: selectedChannel.default_language,
        id: selectedChannel.id,
        status: selectedChannel.status,
        youtube_handle: selectedChannel.youtube_handle,
      }
    : undefined;
  const pkg = buildPackage(normalized, runId, sources, channel);
  const manifest = {
    run_id: runId,
    created_at: now.toISOString(),
    channel: channel ?? null,
    source_mode: sourceModeLabel(normalized.sourceMode),
    source_category_id: normalized.categoryId || null,
    source_candidate_limit: normalized.candidateLimit,
    source_lookback_days: normalized.lookbackDays,
    source_region_code: normalized.regionCode,
    status: "needs_review",
    paths: {
      production_package: "production-package.json",
      brief: "brief.json",
      sources: "sources.json",
      qa: "08-qa.md",
    },
    next_actions: [
      "Enrich research with youtube-market-research.",
      "Analyze source videos with youtube-video-analysis.",
      "Build claim ledger with youtube-fact-check.",
      "Draft script plan with youtube-script-architect.",
    ],
  };

  return createRunWorkspace({
    createdAt: now.toISOString(),
    files: {
      "manifest.json": jsonContent(manifest),
      "brief.json": jsonContent(pkg.brief),
      "sources.json": jsonContent(sources),
      "production-package.json": jsonContent(pkg),
      ...buildMarkdownFiles(pkg),
    },
    id: runId,
    package: pkg,
    status: "needs_review",
  });
}
