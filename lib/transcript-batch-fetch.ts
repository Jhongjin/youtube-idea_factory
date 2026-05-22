import { fetchExternalTranscript, type FetchExternalTranscriptInput } from "@/lib/supadata-transcript";
import { readRunJson, writeRunJson } from "@/lib/run-store";
import type { SourceVideo } from "@/lib/runs";
import { markTranscriptStatus } from "@/lib/transcripts";
import { sourceDedupKey } from "@/lib/youtube-url";

export type BatchFetchTranscriptsInput = FetchExternalTranscriptInput & {
  failedOnly?: boolean;
  sourceKeys?: string[];
};

export type BatchFetchTranscriptItem = {
  error?: string;
  sourceKey: string;
  status: "fetched" | "failed" | "skipped";
  title: string;
  transcriptLength?: number;
};

export type BatchFetchTranscriptsResult = {
  failed: number;
  fetched: number;
  items: BatchFetchTranscriptItem[];
  mode: "native" | "auto" | "generate";
  skipped: number;
  total: number;
};

const fetchConfirmToken = "FETCH_TRANSCRIPT";

function assertSafe(value: string, label: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(value)) {
    throw new Error(`Invalid ${label}.`);
  }
}

function sourceKey(source: SourceVideo) {
  if (source.video_id) {
    return source.video_id;
  }
  if (typeof source.rank === "number") {
    return `source-${source.rank}`;
  }
  return sourceDedupKey(source);
}

function sourceMatches(source: SourceVideo, key: string) {
  return sourceKey(source) === key || sourceDedupKey(source) === key || source.url === key;
}

function hasTranscript(source: SourceVideo) {
  return ["external_transcript", "manual_transcript", "stt_transcript", "available"].includes(
    source.transcript_status ?? "",
  );
}

function isFailed(source: SourceVideo) {
  return source.transcript_status === "missing";
}

async function appendBatchLog(runId: string, result: BatchFetchTranscriptsResult) {
  const existing = await readRunJson<unknown[]>(runId, "transcript-batch-log.json").catch(() => []);
  await writeRunJson(runId, "transcript-batch-log.json", [
    ...existing,
    {
      ...result,
      created_at: new Date().toISOString(),
    },
  ]);
}

export async function batchFetchExternalTranscripts(
  runId: string,
  input: BatchFetchTranscriptsInput,
): Promise<BatchFetchTranscriptsResult> {
  assertSafe(runId, "run id");
  if (input.confirmFetch !== fetchConfirmToken) {
    throw new Error(`배치 자막 가져오기는 ${fetchConfirmToken} 승인 토큰이 필요합니다.`);
  }

  const sources = await readRunJson<SourceVideo[]>(runId, "sources.json");
  const keys = new Set((input.sourceKeys ?? []).map((key) => key.trim()).filter(Boolean));
  const selectedSources = sources.filter((source) => {
    if (keys.size > 0 && !Array.from(keys).some((key) => sourceMatches(source, key))) {
      return false;
    }
    if (input.failedOnly && !isFailed(source)) {
      return false;
    }
    return Boolean(source.url);
  });
  const mode = input.mode === "native" || input.mode === "generate" ? input.mode : "auto";
  const items: BatchFetchTranscriptItem[] = [];

  for (const source of selectedSources) {
    const key = sourceKey(source);
    if (!input.failedOnly && hasTranscript(source)) {
      items.push({
        sourceKey: key,
        status: "skipped",
        title: source.title,
      });
      continue;
    }

    try {
      const result = await fetchExternalTranscript(runId, key, {
        confirmFetch: fetchConfirmToken,
        language: input.language,
        mode,
      });
      items.push({
        sourceKey: key,
        status: "fetched",
        title: source.title,
        transcriptLength: result.transcriptLength,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Transcript fetch failed.";
      await markTranscriptStatus(runId, key, {
        error: message,
        provider: "Supadata",
        status: "missing",
      });
      items.push({
        error: message,
        sourceKey: key,
        status: "failed",
        title: source.title,
      });
    }
  }

  const result: BatchFetchTranscriptsResult = {
    failed: items.filter((item) => item.status === "failed").length,
    fetched: items.filter((item) => item.status === "fetched").length,
    items,
    mode,
    skipped: items.filter((item) => item.status === "skipped").length,
    total: selectedSources.length,
  };
  await appendBatchLog(runId, result);
  return result;
}
