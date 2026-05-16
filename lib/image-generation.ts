import { generateFalImage, type GenerateFalMediaResult } from "@/lib/fal-media-generation";
import {
  generateOpenAIImage,
  type GenerateImageRequest,
  type GenerateImageResult,
} from "@/lib/openai-image-generation";
import { getProviderSettings, resolveProviderSetting } from "@/lib/provider-settings";

export type { GenerateImageRequest, GenerateImageResult };

export async function generateImageAsset(
  runId: string,
  request: GenerateImageRequest,
): Promise<GenerateImageResult | GenerateFalMediaResult> {
  const settings = await getProviderSettings();
  const imageProvider = resolveProviderSetting(settings, "image", request.providerProfileId);
  if (imageProvider.provider === "OpenAI") {
    return generateOpenAIImage(runId, request, imageProvider);
  }
  if (imageProvider.provider === "fal.ai") {
    return generateFalImage(runId, request, imageProvider);
  }
  throw new Error(`Direct image generation is not implemented for provider: ${imageProvider.provider}`);
}
