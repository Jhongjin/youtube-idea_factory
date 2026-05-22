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

export type UpdateRunSourcesInput = {
  action?: "dedupe" | "exclude" | "include" | "keep";
  reason?: string;
  sourceKeys?: string[];
};

export type RemoveRunSourcesResult = {
  removed: number;
  sources: SourceVideo[];
};

export type UpdateRunSourcesResult = {
  changed: number;
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
    "| Rank | URL | Video ID | Title | Channel | Reason | Transcript | Analysis |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
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
      source.analysis_excluded ? "excluded" : "included",
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

function keySetFromInput(input: UpdateRunSourcesInput) {
  return new Set((input.sourceKeys ?? []).map((key) => key.trim()).filter(Boolean));
}

function rerankSources(sources: Array<SourceVideo & Record<string, unknown>>) {
  return sources.map((source, index) => ({ ...source, rank: index + 1 }));
}

async function persistSources(runId: string, sources: Array<SourceVideo & Record<string, unknown>>) {
  const productionPackage = await readRunJson<ProductionPackage>(runId, "production-package.json");
  productionPackage.sources = sources;
  await Promise.all([
    writeRunJson(runId, "sources.json", sources),
    writeRunJson(runId, "production-package.json", productionPackage),
    updateResearchMarkdown(runId, sources),
  ]);
}

export async function updateRunSources(
  runId: string,
  input: UpdateRunSourcesInput,
): Promise<UpdateRunSourcesResult> {
  assertSafeRunId(runId);
  const action = input.action ?? "";
  const sources = await readRunJson<Array<SourceVideo & Record<string, unknown>>>(runId, "sources.json");
  let nextSources = sources;
  let changed = 0;
  let removed = 0;

  if (action === "dedupe") {
    const seen = new Set<string>();
    nextSources = sources.filter((source) => {
      const key = sourceDedupKey(source);
      if (seen.has(key)) {
        removed += 1;
        return false;
      }
      seen.add(key);
      return true;
    });
    nextSources = rerankSources(nextSources);
    changed = removed;
  } else if (action === "keep") {
    const keys = keySetFromInput(input);
    if (keys.size === 0) {
      throw new Error("유지할 소스가 선택되지 않았습니다.");
    }
    nextSources = rerankSources(
      sources.filter((source) => Array.from(keys).some((key) => matchesSourceKey(source, key))),
    );
    removed = sources.length - nextSources.length;
    changed = removed;
  } else if (action === "exclude" || action === "include") {
    const keys = keySetFromInput(input);
    if (keys.size === 0) {
      throw new Error("변경할 소스가 선택되지 않았습니다.");
    }
    const excluded = action === "exclude";
    const reason =
      input.reason?.trim() ||
      (excluded ? "Excluded from analysis in source review." : "Included in analysis in source review.");
    nextSources = sources.map((source) => {
      const matches = Array.from(keys).some((key) => matchesSourceKey(source, key));
      if (!matches) {
        return source;
      }
      changed += 1;
      return excluded
        ? { ...source, analysis_excluded: true, analysis_exclusion_reason: reason }
        : { ...source, analysis_excluded: false, analysis_exclusion_reason: "" };
    });
  } else {
    throw new Error("지원하지 않는 소스 작업입니다.");
  }

  await persistSources(runId, nextSources);
  return {
    changed,
    removed,
    sources: nextSources,
  };
}
