import {
  readRunFileIfExists,
  readRunJson,
  writeRunFile,
  writeRunJson,
} from "@/lib/run-store";
import type { ProductionPackage, SourceVideo } from "@/lib/runs";
import { decodeHtmlEntities } from "@/lib/html-text";

export type SourceEnrichmentResult = {
  updatedFields: number;
  failures: string[];
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

async function fetchOEmbed(url: string) {
  const endpoint = new URL("https://www.youtube.com/oembed");
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("format", "json");

  const response = await fetch(endpoint, {
    headers: { "User-Agent": "youtube-idea-factory/0.1" },
  });

  if (!response.ok) {
    throw new Error(`oEmbed ${response.status}`);
  }

  return (await response.json()) as {
    title?: string;
    author_name?: string;
    thumbnail_url?: string;
  };
}

export async function enrichSources(runId: string): Promise<SourceEnrichmentResult> {
  assertSafeRunId(runId);
  const sources = await readRunJson<Array<SourceVideo & Record<string, unknown>>>(runId, "sources.json");
  const productionPackage = await readRunJson<ProductionPackage>(runId, "production-package.json");

  let updatedFields = 0;
  const failures: string[] = [];

  for (const source of sources) {
    try {
      const metadata = await fetchOEmbed(source.url);
      const title = decodeHtmlEntities(metadata.title?.trim() ?? "");
      const channel = decodeHtmlEntities(metadata.author_name?.trim() ?? "");

      if (title && source.title !== title) {
        source.title = title;
        updatedFields += 1;
      }
      if (channel && source.channel !== channel) {
        source.channel = channel;
        updatedFields += 1;
      }

      source.metadata_status = "oembed_enriched";
      source.thumbnail_url = metadata.thumbnail_url ?? "";
    } catch (error) {
      source.metadata_status = "failed";
      failures.push(`${source.url}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  productionPackage.sources = sources;
  await Promise.all([
    writeRunJson(runId, "sources.json", sources),
    writeRunJson(runId, "production-package.json", productionPackage),
    updateResearchMarkdown(runId, sources),
  ]);

  return { updatedFields, failures, sources };
}
