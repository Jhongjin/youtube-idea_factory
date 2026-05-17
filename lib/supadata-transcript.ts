import { getProviderSettings, resolvePreferredProviderSetting } from "@/lib/provider-settings";
import { readRunJson } from "@/lib/run-store";
import type { SourceVideo } from "@/lib/runs";
import { saveTranscript } from "@/lib/transcripts";
import { sourceDedupKey } from "@/lib/youtube-url";

export type FetchExternalTranscriptInput = {
  confirmFetch: string;
  language?: string;
  mode?: "native" | "auto" | "generate";
};

export type FetchExternalTranscriptResult = {
  language: string;
  provider: string;
  status: string;
  transcriptLength: number;
};

const fetchConfirmToken = "FETCH_TRANSCRIPT";

type SupadataTranscriptResponse = {
  availableLangs?: string[];
  content?: string;
  error?: string;
  jobId?: string;
  lang?: string;
  result?: SupadataTranscriptResponse;
  status?: "queued" | "active" | "completed" | "failed";
  text?: string;
  transcript?: string;
  chunks?: Array<{
    text?: string;
    content?: string;
  }>;
};

function assertSafe(value: string, label: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(value)) {
    throw new Error(`Invalid ${label}.`);
  }
}

function matchesSource(source: SourceVideo, sourceKey: string) {
  return (
    source.video_id === sourceKey ||
    (typeof source.rank === "number" && `source-${source.rank}` === sourceKey) ||
    sourceDedupKey(source) === sourceKey
  );
}

async function resolveSupadataApiKey() {
  const settings = await getProviderSettings();
  const subtitles = resolvePreferredProviderSetting(settings, "subtitles");
  const provider = subtitles.provider.trim().toLowerCase();
  if (subtitles.enabled && provider === "supadata" && subtitles.apiKey?.trim()) {
    return subtitles.apiKey.trim();
  }

  const envKey = process.env.SUPADATA_API_KEY?.trim();
  if (envKey) {
    return envKey;
  }

  throw new Error("Supadata API key is missing. Add SUPADATA_API_KEY or enable Supadata under subtitles settings.");
}

function transcriptText(response: SupadataTranscriptResponse) {
  if (response.result) {
    return transcriptText(response.result);
  }
  const direct = response.content ?? response.text ?? response.transcript ?? "";
  if (direct.trim()) {
    return direct.trim();
  }
  return (response.chunks ?? [])
    .map((chunk) => chunk.text ?? chunk.content ?? "")
    .join("\n")
    .trim();
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchSupadataJob({
  apiKey,
  jobId,
}: {
  apiKey: string;
  jobId: string;
}) {
  const endpoint = new URL(`https://api.supadata.ai/v1/transcript/${encodeURIComponent(jobId)}`);
  const response = await fetch(endpoint, {
    headers: {
      "User-Agent": "youtube-idea-factory/0.1",
      "x-api-key": apiKey,
    },
  });
  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`Supadata transcript job ${response.status}: ${bodyText.slice(0, 240)}`);
  }
  return JSON.parse(bodyText) as SupadataTranscriptResponse;
}

async function fetchSupadataTranscript({
  apiKey,
  language,
  mode,
  url,
}: {
  apiKey: string;
  language: string;
  mode: "native" | "auto" | "generate";
  url: string;
}) {
  const endpoint = new URL("https://api.supadata.ai/v1/transcript");
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("text", "true");
  endpoint.searchParams.set("mode", mode);
  if (language.trim()) {
    endpoint.searchParams.set("lang", language.trim());
  }

  const response = await fetch(endpoint, {
    headers: {
      "User-Agent": "youtube-idea-factory/0.1",
      "x-api-key": apiKey,
    },
  });
  const bodyText = await response.text();

  if (!response.ok) {
    throw new Error(`Supadata transcript ${response.status}: ${bodyText.slice(0, 240)}`);
  }

  const body = JSON.parse(bodyText) as SupadataTranscriptResponse;
  if (body.jobId) {
    for (let attempt = 0; attempt < 25; attempt += 1) {
      await sleep(1000);
      const job = await fetchSupadataJob({ apiKey, jobId: body.jobId });
      if (job.status === "failed") {
        throw new Error(`Supadata transcript job failed: ${job.error ?? "unknown error"}`);
      }
      if (job.status === "completed" || transcriptText(job)) {
        const jobContent = transcriptText(job);
        if (!jobContent) {
          throw new Error("Supadata completed the job but returned an empty transcript.");
        }
        return {
          content: jobContent,
          language: job.lang ?? language,
        };
      }
    }
    throw new Error("Supadata transcript job is still processing. Try again in a moment.");
  }

  const content = transcriptText(body);
  if (!content) {
    throw new Error("Supadata returned an empty transcript.");
  }
  return {
    content,
    language: body.lang ?? language,
  };
}

export async function fetchExternalTranscript(
  runId: string,
  sourceKey: string,
  input: FetchExternalTranscriptInput,
): Promise<FetchExternalTranscriptResult> {
  assertSafe(runId, "run id");
  assertSafe(sourceKey, "source key");
  if (input.confirmFetch !== fetchConfirmToken) {
    throw new Error(`외부 자막 가져오기는 ${fetchConfirmToken} 승인 토큰이 필요합니다.`);
  }

  const sources = await readRunJson<SourceVideo[]>(runId, "sources.json");
  const source = sources.find((candidate) => matchesSource(candidate, sourceKey));
  if (!source?.url) {
    throw new Error("선택한 소스 URL을 찾을 수 없습니다.");
  }

  const mode = input.mode === "native" || input.mode === "generate" ? input.mode : "auto";
  const language = input.language?.trim() || "ko";
  const apiKey = await resolveSupadataApiKey();
  const transcript = await fetchSupadataTranscript({
    apiKey,
    language,
    mode,
    url: source.url,
  });

  await saveTranscript(runId, sourceKey, transcript.content, {
    model: mode,
    provider: "Supadata",
    sourceUrl: source.url,
    status: "external_transcript",
  });

  return {
    language: transcript.language,
    provider: "Supadata",
    status: "external_transcript",
    transcriptLength: transcript.content.length,
  };
}
