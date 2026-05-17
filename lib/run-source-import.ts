import {
  readRunFileIfExists,
  readRunJson,
  writeRunFile,
  writeRunJson,
} from "@/lib/run-store";
import type { ProductionPackage, SourceVideo } from "@/lib/runs";
import type { YouTubeCandidate } from "@/lib/youtube-finder";
import { extractYouTubeVideoId, normalizeYouTubeUrl, sourceDedupKey } from "@/lib/youtube-url";

export type ImportSourcesInput = {
  candidates: YouTubeCandidate[];
  mode?: "append" | "replace";
  seedUrls?: string[];
};

export type ImportSourcesResult = {
  imported: number;
  skipped: number;
  sources: SourceVideo[];
};

function assertSafeRunId(runId: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error("Invalid run id.");
  }
}

function sourceRows(sources: SourceVideo[]) {
  const lines = [
    "| Rank | URL | Video ID | Title | Channel | Reason | Transcript |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];

  for (const source of sources) {
    const values = [
      String(source.rank ?? ""),
      source.url,
      source.video_id ?? "",
      source.title,
      source.channel ?? "",
      source.inclusion_reason,
      source.transcript_status ?? "",
    ];
    lines.push(`| ${values.map((value) => value.replace(/\n/g, " ").replace(/\|/g, "\\|")).join(" | ")} |`);
  }

  return lines.join("\n");
}

async function updateResearchMarkdown(runId: string, sources: SourceVideo[]) {
  const content = (await readRunFileIfExists(runId, "01-research.md")) ?? "";
  const marker = "## Source Videos";
  const nextMarker = "\n## Research Summary";
  if (!content.includes(marker) || !content.includes(nextMarker)) {
    return;
  }

  const [before] = content.split(marker, 1);
  const [, after] = content.split(nextMarker, 2);
  await writeRunFile(runId, "01-research.md", `${before}${marker}\n\n${sourceRows(sources)}\n${nextMarker}${after}`);
}

function normalizeCandidate(candidate: YouTubeCandidate, rank: number): SourceVideo & Record<string, unknown> {
  return {
    rank,
    url: normalizeYouTubeUrl(candidate.url),
    title: candidate.title,
    channel: candidate.channel,
    inclusion_reason: "Imported from YouTube Finder.",
    transcript_status: "not_checked",
    video_id: candidate.videoId,
    source_mode: "youtube_finder",
    metadata_status: "youtube_data_api",
    thumbnail_url: candidate.thumbnailUrl,
    published_at: candidate.publishedAt,
    view_count: candidate.viewCount,
    like_count: candidate.likeCount,
    comment_count: candidate.commentCount,
    duration: candidate.duration,
    duration_seconds: candidate.durationSeconds,
    channel_id: candidate.channelId,
    description: candidate.description,
  };
}

function normalizeManualUrl(url: string, rank: number): SourceVideo & Record<string, unknown> {
  const normalizedUrl = normalizeYouTubeUrl(url);
  const videoId = extractYouTubeVideoId(normalizedUrl);
  return {
    rank,
    url: normalizedUrl,
    title: `Manual source ${rank}: ${videoId || normalizedUrl}`,
    channel: "",
    inclusion_reason: "Manually added in source review.",
    transcript_status: "not_checked",
    video_id: videoId,
    source_mode: "manual_add",
    metadata_status: "manual_pending",
  };
}

export async function importRunSources(runId: string, input: ImportSourcesInput): Promise<ImportSourcesResult> {
  assertSafeRunId(runId);
  const existingSources =
    input.mode === "replace" ? [] : await readRunJson<Array<SourceVideo & Record<string, unknown>>>(runId, "sources.json");
  const productionPackage = await readRunJson<ProductionPackage>(runId, "production-package.json");

  const existingKeys = new Set(existingSources.map((source) => sourceDedupKey(source)));
  const importedSources = [...existingSources];
  let imported = 0;
  let skipped = 0;

  for (const candidate of input.candidates) {
    const key = sourceDedupKey(candidate);
    if (!candidate.url || existingKeys.has(key)) {
      skipped += 1;
      continue;
    }
    existingKeys.add(key);
    importedSources.push(normalizeCandidate(candidate, importedSources.length + 1));
    imported += 1;
  }

  for (const seedUrl of input.seedUrls ?? []) {
    const trimmedUrl = seedUrl.trim();
    const key = sourceDedupKey({ url: trimmedUrl });
    if (!trimmedUrl || existingKeys.has(key)) {
      skipped += 1;
      continue;
    }
    existingKeys.add(key);
    importedSources.push(normalizeManualUrl(trimmedUrl, importedSources.length + 1));
    imported += 1;
  }

  const reranked = importedSources.map((source, index) => ({ ...source, rank: index + 1 }));
  productionPackage.sources = reranked;

  await Promise.all([
    writeRunJson(runId, "sources.json", reranked),
    writeRunJson(runId, "production-package.json", productionPackage),
    updateResearchMarkdown(runId, reranked),
  ]);

  return {
    imported,
    skipped,
    sources: reranked,
  };
}
