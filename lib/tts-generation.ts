import { generateInworldTts } from "@/lib/inworld-tts-generation";
import {
  generateOpenAITts,
  type GenerateVoiceRequest,
  type GenerateVoiceResult,
} from "@/lib/openai-tts-generation";
import { getProviderSettings } from "@/lib/provider-settings";

export type { GenerateVoiceRequest, GenerateVoiceResult };

export async function generateVoiceAsset(
  runId: string,
  request: GenerateVoiceRequest,
): Promise<GenerateVoiceResult> {
  const provider = (await getProviderSettings()).roles.tts.provider;
  if (provider === "OpenAI") {
    return generateOpenAITts(runId, request);
  }
  if (provider === "Inworld") {
    return generateInworldTts(runId, request);
  }
  throw new Error(`Direct TTS generation is not implemented for provider: ${provider}`);
}
