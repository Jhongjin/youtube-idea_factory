import { promises as fs } from "node:fs";
import path from "node:path";
import type { ProductionPackage, SourceVideo } from "@/lib/runs";

export type SourceEnrichmentResult = {
  updatedFields: number;
  failures: string[];
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
  const runDir = path.join(runsDir, runId);
  const sourcesPath = path.join(runDir, "sources.json");
  const packagePath = path.join(runDir, "production-package.json");
  const sources = await loadJson<Array<SourceVideo & Record<string, unknown>>>(sourcesPath);
  const productionPackage = await loadJson<ProductionPackage>(packagePath);

  let updatedFields = 0;
  const failures: string[] = [];

  for (const source of sources) {
    try {
      const metadata = await fetchOEmbed(source.url);
      const title = metadata.title?.trim();
      const channel = metadata.author_name?.trim();

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
    writeJson(sourcesPath, sources),
    writeJson(packagePath, productionPackage),
    updateResearchMarkdown(runDir, sources),
  ]);

  return { updatedFields, failures, sources };
}

