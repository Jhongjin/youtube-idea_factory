import {
  readRunFileIfExists,
  readRunJson,
  writeRunFile,
  writeRunJson,
} from "@/lib/run-store";
import type { ProductionPackage, SourceVideo } from "@/lib/runs";
import { sourceDedupKey } from "@/lib/youtube-url";

export type RemoveRunSourcesInput = {
  all?: boolean;
  sourceKey?: string;
};

export type RemoveRunSourcesResult = {
  removed: number;
  sources: SourceVideo[];
};

function assertSafeRunId(runId: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error("Invalid run id.");
  }
}

function keyForSource(source: SourceVideo) {
  if (source.video_id) {
    return source.video_id;
  }
  if (typeof source.rank === "number") {
    return `source-${source.rank}`;
  }
  return sourceDedupKey(source);
}

function matchesSourceKey(source: SourceVideo, sourceKey: string) {
  return keyForSource(source) === sourceKey || sourceDedupKey(source) === sourceKey || source.url === sourceKey;
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

export async function removeRunSources(
  runId: string,
  input: RemoveRunSourcesInput,
): Promise<RemoveRunSourcesResult> {
  assertSafeRunId(runId);
  const sources = await readRunJson<Array<SourceVideo & Record<string, unknown>>>(runId, "sources.json");
  const productionPackage = await readRunJson<ProductionPackage>(runId, "production-package.json");

  const sourceKey = input.sourceKey?.trim() ?? "";
  if (!input.all && !sourceKey) {
    throw new Error("삭제할 소스가 선택되지 않았습니다.");
  }

  const nextSources = input.all
    ? []
    : sources.filter((source) => !matchesSourceKey(source, sourceKey));
  const reranked = nextSources.map((source, index) => ({ ...source, rank: index + 1 }));

  productionPackage.sources = reranked;
  await Promise.all([
    writeRunJson(runId, "sources.json", reranked),
    writeRunJson(runId, "production-package.json", productionPackage),
    updateResearchMarkdown(runId, reranked),
  ]);

  return {
    removed: sources.length - reranked.length,
    sources: reranked,
  };
}
