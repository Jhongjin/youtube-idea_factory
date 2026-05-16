import { generateInworldTts } from "@/lib/inworld-tts-generation";
import {
  generateOpenAITts,
  type GenerateVoiceRequest,
  type GenerateVoiceResult,
} from "@/lib/openai-tts-generation";
import { getProviderSettings, resolveProviderSetting } from "@/lib/provider-settings";

export type { GenerateVoiceRequest, GenerateVoiceResult };

export async function generateVoiceAsset(
  runId: string,
  request: GenerateVoiceRequest,
): Promise<GenerateVoiceResult> {
  const settings = await getProviderSettings();
  const ttsProvider = resolveProviderSetting(settings, "tts", request.providerProfileId);
  if (ttsProvider.provider === "OpenAI") {
    return generateOpenAITts(runId, request, ttsProvider);
  }
  if (ttsProvider.provider === "Inworld") {
    return generateInworldTts(runId, request, ttsProvider);
  }
  throw new Error(`Direct TTS generation is not implemented for provider: ${ttsProvider.provider}`);
}
