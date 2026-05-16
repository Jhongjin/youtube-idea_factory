import {
  getStaticProviderModels,
  supportsLiveProviderModelRefresh,
  type ProviderModelOption,
} from "@/lib/provider-model-catalog-shared";
import type { ProviderRoleId, ProviderRoleSetting } from "@/lib/provider-settings-shared";

type OpenAiModelList = {
  data?: Array<{ id?: string }>;
};

type GeminiModelList = {
  models?: Array<{
    displayName?: string;
    name?: string;
    supportedGenerationMethods?: string[];
  }>;
};

type OpenRouterModelList = {
  data?: Array<{
    id?: string;
    name?: string;
    architecture?: {
      input_modalities?: string[];
      output_modalities?: string[];
    };
  }>;
};

function normalizeProvider(provider: string) {
  return provider.trim().toLowerCase();
}

function uniqueModels(models: ProviderModelOption[]) {
  const seen = new Set<string>();
  return models.filter((model) => {
    const key = model.id.trim();
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function isModelForRole(role: ProviderRoleId, modelId: string) {
  const id = modelId.toLowerCase();
  const isTranscription = /transcribe|whisper|speech-to-text|stt/u.test(id);
  const isTts = (/\btts\b|text-to-speech|voice/u.test(id) || /speech/u.test(id)) && !isTranscription;
  const isImage = /image|dall-e|imagen|flux|sdxl|stable-diffusion/u.test(id);
  const isVideo = /sora|video|veo|runway|kling|luma|pika|ray-|gen-?\d|wan|hunyuan|seedance/u.test(id);
  const isNonLlm = isTts || isTranscription || isImage || isVideo || /embedding|moderation|realtime/u.test(id);

  if (role === "llm") {
    return !isNonLlm;
  }
  if (role === "image") {
    return isImage;
  }
  if (role === "video") {
    return isVideo;
  }
  if (role === "tts") {
    return isTts;
  }
  if (role === "subtitles") {
    return isTranscription;
  }
  return false;
}

function modelUrlFromBase(baseUrl: string, fallback: string) {
  const trimmed = baseUrl.trim().replace(/\/+$/u, "");
  if (!trimmed) {
    return fallback;
  }

  try {
    const url = new URL(trimmed);
    if (url.pathname.endsWith("/models")) {
      return url.toString();
    }
    if (url.pathname.endsWith("/responses")) {
      url.pathname = url.pathname.replace(/\/responses$/u, "/models");
      return url.toString();
    }
    if (url.pathname.endsWith("/chat/completions")) {
      url.pathname = url.pathname.replace(/\/chat\/completions$/u, "/models");
      return url.toString();
    }
    if (url.pathname.endsWith("/v1") || url.pathname.endsWith("/v1beta")) {
      url.pathname = `${url.pathname}/models`;
      return url.toString();
    }
  } catch {
    return `${trimmed}/models`;
  }

  return `${trimmed}/models`;
}

async function fetchJson<T>(url: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Model catalog ${response.status}: ${text.slice(0, 220)}`);
  }
  return JSON.parse(text) as T;
}

async function fetchOpenAiModels(role: ProviderRoleId, setting: ProviderRoleSetting) {
  if (!setting.apiKey?.trim()) {
    throw new Error("OpenAI model refresh requires a saved API key.");
  }
  const data = await fetchJson<OpenAiModelList>(
    modelUrlFromBase(setting.baseUrl, "https://api.openai.com/v1/models"),
    {
      headers: {
        Authorization: `Bearer ${setting.apiKey}`,
      },
    },
  );
  return (data.data ?? [])
    .map((model) => model.id?.trim() ?? "")
    .filter((id) => isModelForRole(role, id))
    .map((id) => ({ id, label: id, source: "live" as const }));
}

async function fetchGeminiModels(role: ProviderRoleId, setting: ProviderRoleSetting) {
  if (!setting.apiKey?.trim()) {
    throw new Error("Google model refresh requires a saved API key.");
  }
  const baseUrl = setting.baseUrl.trim() || "https://generativelanguage.googleapis.com/v1beta";
  const url = new URL(modelUrlFromBase(baseUrl, "https://generativelanguage.googleapis.com/v1beta/models"));
  url.searchParams.set("key", setting.apiKey);
  url.searchParams.set("pageSize", "1000");
  const data = await fetchJson<GeminiModelList>(url.toString());
  return (data.models ?? [])
    .map((model) => {
      const id = (model.name ?? "").replace(/^models\//u, "").trim();
      const label = model.displayName?.trim() || id;
      return { id, label, source: "live" as const };
    })
    .filter((model) => model.id && isModelForRole(role, model.id));
}

async function fetchOpenRouterModels(role: ProviderRoleId, setting: ProviderRoleSetting) {
  if (role !== "llm") {
    return [];
  }
  const headers: Record<string, string> = {};
  if (setting.apiKey?.trim()) {
    headers.Authorization = `Bearer ${setting.apiKey}`;
  }
  const data = await fetchJson<OpenRouterModelList>(
    modelUrlFromBase(setting.baseUrl, "https://openrouter.ai/api/v1/models"),
    { headers },
  );
  return (data.data ?? [])
    .filter((model) => (model.architecture?.output_modalities ?? ["text"]).includes("text"))
    .map((model) => {
      const id = model.id?.trim() ?? "";
      return { id, label: model.name?.trim() || id, source: "live" as const };
    })
    .filter((model) => model.id);
}

export async function getProviderModels(
  role: ProviderRoleId,
  setting: ProviderRoleSetting,
): Promise<ProviderModelOption[]> {
  const provider = normalizeProvider(setting.provider);
  const staticModels = getStaticProviderModels(role, setting.provider);
  if (!supportsLiveProviderModelRefresh(setting.provider)) {
    return staticModels;
  }

  const liveModels =
    provider === "openai"
      ? await fetchOpenAiModels(role, setting)
      : provider === "google"
        ? await fetchGeminiModels(role, setting)
        : provider === "openrouter"
          ? await fetchOpenRouterModels(role, setting)
          : [];

  return uniqueModels([...liveModels, ...staticModels]).sort((a, b) => a.id.localeCompare(b.id));
}
