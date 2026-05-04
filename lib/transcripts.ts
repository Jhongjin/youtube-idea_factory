import { promises as fs } from "node:fs";
import path from "node:path";
import type { ProductionPackage, SourceVideo } from "@/lib/runs";

export type TranscriptPayload = {
  sourceKey: string;
  content: string;
  updatedAt: string;
  status: string;
};

const runsDir = path.join(/* turbopackIgnore: true */ process.cwd(), "runs");
const maxTranscriptBytes = 1_000_000;

function assertSafe(value: string, label: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(value)) {
    throw new Error(`Invalid ${label}.`);
  }
}

function getRunDir(runId: string) {
  assertSafe(runId, "run id");
  return path.join(runsDir, runId);
}

function getTranscriptPath(runId: string, sourceKey: string) {
  assertSafe(sourceKey, "source key");
  return path.join(getRunDir(runId), "transcripts", `${sourceKey}.txt`);
}

async function loadJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, "utf-8")) as T;
}

async function writeJson(filePath: string, payload: unknown) {
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
}

function matchesSource(source: SourceVideo, sourceKey: string) {
  return source.video_id === sourceKey || `source-${source.rank ?? ""}` === sourceKey;
}

async function updateSourceStatus(runId: string, sourceKey: string, content: string) {
  const runDir = getRunDir(runId);
  const sourcesPath = path.join(runDir, "sources.json");
  const packagePath = path.join(runDir, "production-package.json");
  const sources = await loadJson<Array<SourceVideo & Record<string, unknown>>>(sourcesPath);
  const productionPackage = await loadJson<ProductionPackage>(packagePath);
  const status = content.trim() ? "manual_transcript" : "not_checked";
  const transcriptPath = content.trim() ? `transcripts/${sourceKey}.txt` : "";
  const updatedAt = new Date().toISOString();

  const updatedSources = sources.map((source) => {
    if (!matchesSource(source, sourceKey)) {
      return source;
    }
    return {
      ...source,
      transcript_status: status,
      transcript_path: transcriptPath,
      transcript_updated_at: content.trim() ? updatedAt : "",
    };
  });

  productionPackage.sources = updatedSources;
  await Promise.all([writeJson(sourcesPath, updatedSources), writeJson(packagePath, productionPackage)]);

  return { status, updatedAt };
}

export async function getTranscript(runId: string, sourceKey: string): Promise<TranscriptPayload> {
  const transcriptPath = getTranscriptPath(runId, sourceKey);
  const content = await fs.readFile(transcriptPath, "utf-8").catch(() => "");
  const stat = await fs.stat(transcriptPath).catch(() => null);
  return {
    sourceKey,
    content,
    updatedAt: stat?.mtime.toISOString() ?? "",
    status: content.trim() ? "manual_transcript" : "missing",
  };
}

export async function saveTranscript(runId: string, sourceKey: string, content: string) {
  const transcriptPath = getTranscriptPath(runId, sourceKey);
  const bytes = Buffer.byteLength(content, "utf-8");
  if (bytes > maxTranscriptBytes) {
    throw new Error(`Transcript is too large. Max size is ${maxTranscriptBytes} bytes.`);
  }

  await fs.mkdir(path.dirname(transcriptPath), { recursive: true });
  await fs.writeFile(transcriptPath, content.endsWith("\n") ? content : `${content}\n`, "utf-8");
  const { status, updatedAt } = await updateSourceStatus(runId, sourceKey, content);

  return {
    sourceKey,
    content,
    updatedAt,
    status,
  };
}

