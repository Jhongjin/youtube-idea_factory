import { generateFalImage, type GenerateFalMediaResult } from "@/lib/fal-media-generation";
import {
  generateOpenAIImage,
  type GenerateImageRequest,
  type GenerateImageResult,
} from "@/lib/openai-image-generation";
import { getProviderSettings } from "@/lib/provider-settings";

export type { GenerateImageRequest, GenerateImageResult };

export async function generateImageAsset(
  runId: string,
  request: GenerateImageRequest,
): Promise<GenerateImageResult | GenerateFalMediaResult> {
  const provider = (await getProviderSettings()).roles.image.provider;
  if (provider === "OpenAI") {
    return generateOpenAIImage(runId, request);
  }
  if (provider === "fal.ai") {
    return generateFalImage(runId, request);
  }
  throw new Error(`Direct image generation is not implemented for provider: ${provider}`);
}
