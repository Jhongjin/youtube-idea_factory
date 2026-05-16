import type { ProviderRoleSetting } from "@/lib/provider-settings-shared";
import {
  getProviderSettings,
  resolvePreferredProviderSetting,
  resolveProviderSetting,
} from "@/lib/provider-settings";

export type LlmTextRequest = {
  task: string;
  instructions: string;
  input: string;
  providerProfileId?: string;
};

export type LlmTextResult = {
  text: string;
  provider: string;
  model: string;
  responseId?: string;
};

type OpenAiResponse = {
  id?: string;
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

type ChatCompletionResponse = {
  id?: string;
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

function normalizeProvider(provider: string) {
  return provider.trim().toLowerCase();
}

function requireConfiguredLlm(setting: ProviderRoleSetting) {
  if (!setting.enabled) {
    throw new Error("LLM provider is disabled. Enable it at /settings before using LLM refinement.");
  }
  if (!setting.provider.trim()) {
    throw new Error("LLM provider is missing. Configure it at /settings.");
  }
  if (!setting.model.trim()) {
    throw new Error("LLM model is missing. Set a model or preset at /settings.");
  }
  if (!setting.apiKey?.trim()) {
    throw new Error("LLM API key is missing. Add it at /settings.");
  }
}

function extractOpenAiText(response: OpenAiResponse) {
  if (response.output_text?.trim()) {
    return response.output_text.trim();
  }

  return (
    response.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text ?? "")
      .join("\n")
      .trim() ?? ""
  );
}

async function fetchJson<T>(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`LLM API ${response.status}: ${text.slice(0, 300)}`);
  }

  return JSON.parse(text) as T;
}

async function callOpenAiResponses(
  setting: ProviderRoleSetting,
  request: LlmTextRequest,
): Promise<LlmTextResult> {
  const url = setting.baseUrl.trim() || "https://api.openai.com/v1/responses";
  const response = await fetchJson<OpenAiResponse>(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${setting.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: setting.model,
      instructions: request.instructions,
      input: request.input,
    }),
  });

  const text = extractOpenAiText(response);
  if (!text) {
    throw new Error("LLM response did not include text output.");
  }

  return {
    text,
    provider: setting.provider,
    model: setting.model,
    responseId: response.id,
  };
}

function chatCompletionUrl(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/+$/u, "");
  if (!trimmed) {
    throw new Error("Custom/OpenRouter LLM base URL is required.");
  }
  if (trimmed.endsWith("/chat/completions")) {
    return trimmed;
  }
  return `${trimmed}/chat/completions`;
}

async function callOpenAiCompatibleChat(
  setting: ProviderRoleSetting,
  request: LlmTextRequest,
): Promise<LlmTextResult> {
  const response = await fetchJson<ChatCompletionResponse>(chatCompletionUrl(setting.baseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${setting.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: setting.model,
      messages: [
        { role: "system", content: request.instructions },
        { role: "user", content: request.input },
      ],
    }),
  });

  const text = response.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("LLM chat completion did not include message content.");
  }

  return {
    text,
    provider: setting.provider,
    model: setting.model,
    responseId: response.id,
  };
}

export async function generateLlmText(request: LlmTextRequest): Promise<LlmTextResult> {
  const settings = await getProviderSettings();
  const llm = request.providerProfileId
    ? resolveProviderSetting(settings, "llm", request.providerProfileId)
    : resolvePreferredProviderSetting(settings, "llm");
  requireConfiguredLlm(llm);

  const provider = normalizeProvider(llm.provider);
  if (provider === "openai") {
    return callOpenAiResponses(llm, request);
  }
  if (provider === "openrouter" || provider === "custom") {
    return callOpenAiCompatibleChat(llm, request);
  }

  throw new Error(
    `LLM provider "${llm.provider}" is not implemented yet. Use OpenAI, OpenRouter, or Custom for this adapter.`,
  );
}
