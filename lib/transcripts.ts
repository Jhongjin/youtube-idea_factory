import {
  getRunFileInfo,
  readRunFileIfExists,
  readRunJson,
  writeRunFile,
  writeRunJson,
} from "@/lib/run-store";
import type { ProductionPackage, SourceVideo } from "@/lib/runs";

export type TranscriptPayload = {
  sourceKey: string;
  content: string;
  updatedAt: string;
  status: string;
};

export type SaveTranscriptOptions = {
  status?: "external_transcript" | "manual_transcript" | "stt_transcript";
  provider?: string;
  model?: string;
  sourceUrl?: string;
};

export type MarkTranscriptStatusOptions = {
  error?: string;
  provider?: string;
  status: "missing" | "not_checked";
};

const maxTranscriptBytes = 1_000_000;

function assertSafe(value: string, label: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(value)) {
    throw new Error(`Invalid ${label}.`);
  }
}

function getTranscriptPath(sourceKey: string) {
  assertSafe(sourceKey, "source key");
  return `transcripts/${sourceKey}.txt`;
}

function matchesSource(source: SourceVideo, sourceKey: string) {
  return source.video_id === sourceKey || (typeof source.rank === "number" && `source-${source.rank}` === sourceKey);
}

async function updateSourceStatus(
  runId: string,
  sourceKey: string,
  content: string,
  options: SaveTranscriptOptions = {},
) {
  assertSafe(runId, "run id");
  const sources = await readRunJson<Array<SourceVideo & Record<string, unknown>>>(
    runId,
    "sources.json",
  );
  const productionPackage = await readRunJson<ProductionPackage>(
    runId,
    "production-package.json",
  );
  const status = content.trim() ? (options.status ?? "manual_transcript") : "not_checked";
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
      transcript_provider: content.trim() ? (options.provider ?? source.transcript_provider ?? "") : "",
      transcript_model: content.trim() ? (options.model ?? source.transcript_model ?? "") : "",
      transcript_source_url: content.trim()
        ? (options.sourceUrl ?? source.transcript_source_url ?? "")
        : "",
    };
  });

  productionPackage.sources = updatedSources;
  await Promise.all([
    writeRunJson(runId, "sources.json", updatedSources),
    writeRunJson(runId, "production-package.json", productionPackage),
  ]);

  return { status, updatedAt };
}

export async function getTranscript(runId: string, sourceKey: string): Promise<TranscriptPayload> {
  assertSafe(runId, "run id");
  const transcriptPath = getTranscriptPath(sourceKey);
  const [content, info] = await Promise.all([
    readRunFileIfExists(runId, transcriptPath),
    getRunFileInfo(runId, transcriptPath),
  ]);
  const transcript = content ?? "";
  return {
    sourceKey,
    content: transcript,
    updatedAt: info?.updatedAt ?? "",
    status: transcript.trim() ? "manual_transcript" : "missing",
  };
}

export async function saveTranscript(
  runId: string,
  sourceKey: string,
  content: string,
  options: SaveTranscriptOptions = {},
) {
  assertSafe(runId, "run id");
  const transcriptPath = getTranscriptPath(sourceKey);
  const bytes = Buffer.byteLength(content, "utf-8");
  if (bytes > maxTranscriptBytes) {
    throw new Error(`Transcript is too large. Max size is ${maxTranscriptBytes} bytes.`);
  }

  await writeRunFile(runId, transcriptPath, content);
  const { status, updatedAt } = await updateSourceStatus(runId, sourceKey, content, options);

  return {
    sourceKey,
    content,
    updatedAt,
    status,
  };
}

export async function markTranscriptStatus(
  runId: string,
  sourceKey: string,
  options: MarkTranscriptStatusOptions,
) {
  assertSafe(runId, "run id");
  assertSafe(sourceKey, "source key");
  const sources = await readRunJson<Array<SourceVideo & Record<string, unknown>>>(
    runId,
    "sources.json",
  );
  const productionPackage = await readRunJson<ProductionPackage>(
    runId,
    "production-package.json",
  );
  const updatedAt = new Date().toISOString();
  const updatedSources = sources.map((source) => {
    if (!matchesSource(source, sourceKey)) {
      return source;
    }
    return {
      ...source,
      transcript_error: options.error?.slice(0, 500) ?? "",
      transcript_provider: options.provider ?? source.transcript_provider ?? "",
      transcript_status: options.status,
      transcript_updated_at: updatedAt,
    };
  });

  productionPackage.sources = updatedSources;
  await Promise.all([
    writeRunJson(runId, "sources.json", updatedSources),
    writeRunJson(runId, "production-package.json", productionPackage),
  ]);

  return {
    sourceKey,
    status: options.status,
    updatedAt,
  };
}
