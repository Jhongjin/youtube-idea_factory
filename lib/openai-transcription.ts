import { getProviderSettings } from "@/lib/provider-settings";
import { readRunJson, writeRunJson } from "@/lib/run-store";
import { saveTranscript } from "@/lib/transcripts";

export type TranscribeAudioRequest = {
  audioUrl: string;
  confirmSpend: string;
  language?: string;
  prompt?: string;
};

export type TranscribeAudioResult = {
  sourceKey: string;
  status: string;
  provider: string;
  model: string;
  characters: number;
  audioUrl: string;
};

type OpenAITranscriptionResponse = {
  text?: string;
  error?: {
    message?: string;
  };
};

const confirmToken = "TRANSCRIBE_AUDIO";
const maxAudioBytes = 25_000_000;

function assertSafe(value: string, label: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(value)) {
    throw new Error(`Invalid ${label}.`);
  }
}

function openAiBaseUrl(baseUrl: string) {
  return (baseUrl.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");
}

function safeAudioUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Audio URL must be http or https.");
  }
  return url.toString();
}

function filenameFromUrl(value: string, contentType: string) {
  const pathname = new URL(value).pathname;
  const rawName = pathname.split("/").pop()?.replace(/[^A-Za-z0-9._-]+/g, "-") || "";
  if (rawName.includes(".")) {
    return rawName;
  }
  if (contentType.includes("mpeg")) {
    return "source-audio.mp3";
  }
  if (contentType.includes("wav")) {
    return "source-audio.wav";
  }
  if (contentType.includes("mp4")) {
    return "source-audio.mp4";
  }
  return rawName || "source-audio.bin";
}

async function downloadAudio(audioUrl: string) {
  const response = await fetch(audioUrl);
  if (!response.ok) {
    throw new Error(`Audio download failed with ${response.status}.`);
  }
  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (contentLength > maxAudioBytes) {
    throw new Error(`Audio file is too large. Max size is ${maxAudioBytes} bytes.`);
  }
  const contentType = response.headers.get("content-type") ?? "application/octet-stream";
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > maxAudioBytes) {
    throw new Error(`Audio file is too large. Max size is ${maxAudioBytes} bytes.`);
  }
  return {
    bytes,
    contentType,
    filename: filenameFromUrl(audioUrl, contentType),
  };
}

async function appendTranscriptionLog(runId: string, entry: unknown) {
  const log: unknown[] = await readRunJson<unknown[]>(
    runId,
    "transcript-generation-log.json",
  ).catch((): unknown[] => []);
  log.push(entry);
  await writeRunJson(runId, "transcript-generation-log.json", log);
}

export async function transcribeAudioWithOpenAI(
  runId: string,
  sourceKey: string,
  request: TranscribeAudioRequest,
): Promise<TranscribeAudioResult> {
  assertSafe(runId, "run id");
  assertSafe(sourceKey, "source key");
  if (request.confirmSpend !== confirmToken) {
    throw new Error(`External spend requires confirmSpend="${confirmToken}".`);
  }

  const audioUrl = safeAudioUrl(request.audioUrl.trim());
  const providerSettings = await getProviderSettings();
  const subtitlesProvider = providerSettings.roles.subtitles;
  if (subtitlesProvider.provider !== "OpenAI") {
    throw new Error("OpenAI transcription requires Subtitles provider OpenAI.");
  }
  if (subtitlesProvider.enabled !== true) {
    throw new Error("Subtitles provider is not enabled.");
  }
  if (!subtitlesProvider.apiKey?.trim()) {
    throw new Error("OpenAI transcription API key is missing.");
  }
  if (!subtitlesProvider.model.trim()) {
    throw new Error("OpenAI transcription model is missing. Example: gpt-4o-transcribe.");
  }

  const audio = await downloadAudio(audioUrl);
  const form = new FormData();
  form.set("model", subtitlesProvider.model);
  form.set("file", new Blob([new Uint8Array(audio.bytes)], { type: audio.contentType }), audio.filename);
  if (request.language?.trim()) {
    form.set("language", request.language.trim());
  }
  if (request.prompt?.trim()) {
    form.set("prompt", request.prompt.trim().slice(0, 1000));
  }

  const response = await fetch(`${openAiBaseUrl(subtitlesProvider.baseUrl)}/audio/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${subtitlesProvider.apiKey}`,
    },
    body: form,
  });

  const body = (await response.json().catch(() => null)) as OpenAITranscriptionResponse | null;
  const text = body?.text?.trim() ?? "";
  if (!response.ok || !text) {
    throw new Error(body?.error?.message ?? `OpenAI transcription failed with ${response.status}.`);
  }

  const saved = await saveTranscript(runId, sourceKey, text, {
    status: "stt_transcript",
    provider: subtitlesProvider.provider,
    model: subtitlesProvider.model,
    sourceUrl: audioUrl,
  });
  const now = new Date().toISOString();
  await appendTranscriptionLog(runId, {
    at: now,
    source_key: sourceKey,
    provider: subtitlesProvider.provider,
    model: subtitlesProvider.model,
    audio_url: audioUrl,
    bytes: audio.bytes.byteLength,
    characters: text.length,
    request_id: response.headers.get("x-request-id") ?? "",
  });

  return {
    sourceKey,
    status: saved.status,
    provider: subtitlesProvider.provider,
    model: subtitlesProvider.model,
    characters: text.length,
    audioUrl,
  };
}
