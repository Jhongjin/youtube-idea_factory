import {
  readRunFileIfExists,
  readRunJson,
  writeRunFile,
  writeRunJson,
} from "@/lib/run-store";
import type { ProductionPackage, SourceVideo } from "@/lib/runs";
import type { YouTubeCandidate } from "@/lib/youtube-finder";

export type ImportSourcesInput = {
  candidates: YouTubeCandidate[];
  mode?: "append" | "replace";
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
    url: candidate.url,
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

export async function importRunSources(runId: string, input: ImportSourcesInput): Promise<ImportSourcesResult> {
  assertSafeRunId(runId);
  const existingSources =
    input.mode === "replace" ? [] : await readRunJson<Array<SourceVideo & Record<string, unknown>>>(runId, "sources.json");
  const productionPackage = await readRunJson<ProductionPackage>(runId, "production-package.json");

  const existingUrls = new Set(existingSources.map((source) => source.url));
  const importedSources = [...existingSources];
  let imported = 0;
  let skipped = 0;

  for (const candidate of input.candidates) {
    if (!candidate.url || existingUrls.has(candidate.url)) {
      skipped += 1;
      continue;
    }
    existingUrls.add(candidate.url);
    importedSources.push(normalizeCandidate(candidate, importedSources.length + 1));
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
