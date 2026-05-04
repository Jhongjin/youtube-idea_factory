import { promises as fs } from "node:fs";
import path from "node:path";
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

const runsDir = path.join(/* turbopackIgnore: true */ process.cwd(), "runs");

function assertSafeRunId(runId: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error("Invalid run id.");
  }
}

async function loadJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, "utf-8")) as T;
}

async function writeJson(filePath: string, payload: unknown) {
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
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

async function updateResearchMarkdown(runDir: string, sources: SourceVideo[]) {
  const researchPath = path.join(runDir, "01-research.md");
  const content = await fs.readFile(researchPath, "utf-8").catch(() => "");
  const marker = "## Source Videos";
  const nextMarker = "\n## Research Summary";
  if (!content.includes(marker) || !content.includes(nextMarker)) {
    return;
  }

  const [before] = content.split(marker, 1);
  const [, after] = content.split(nextMarker, 2);
  await fs.writeFile(
    researchPath,
    `${before}${marker}\n\n${sourceRows(sources)}\n${nextMarker}${after}`,
    "utf-8",
  );
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
  const runDir = path.join(runsDir, runId);
  const sourcesPath = path.join(runDir, "sources.json");
  const packagePath = path.join(runDir, "production-package.json");
  const existingSources =
    input.mode === "replace" ? [] : await loadJson<Array<SourceVideo & Record<string, unknown>>>(sourcesPath);
  const productionPackage = await loadJson<ProductionPackage>(packagePath);

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
    writeJson(sourcesPath, reranked),
    writeJson(packagePath, productionPackage),
    updateResearchMarkdown(runDir, reranked),
  ]);

  return {
    imported,
    skipped,
    sources: reranked,
  };
}

