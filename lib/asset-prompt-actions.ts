import type { AssetManifest } from "@/lib/asset-manifest";
import { createGenerationQueue } from "@/lib/generation-queue";
import { readRunJson, writeRunJson } from "@/lib/run-store";

export type UpdateAssetPromptRequest = {
  assetId: string;
  prompt: string;
};

export type UpdateAssetPromptResult = {
  assetId: string;
  prompt: string;
};

function assertSafeRunId(runId: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error("Invalid run id.");
  }
}

function cleanAssetId(value: string | undefined) {
  const assetId = value?.trim() ?? "";
  if (!assetId) {
    throw new Error("assetId is required.");
  }
  return assetId;
}

export async function updateAssetPrompt(
  runId: string,
  request: UpdateAssetPromptRequest,
): Promise<UpdateAssetPromptResult> {
  assertSafeRunId(runId);
  const assetId = cleanAssetId(request.assetId);
  const prompt = request.prompt?.trim() ?? "";
  if (!prompt) {
    throw new Error("제작 요청문을 입력하세요.");
  }

  const manifest = await readRunJson<AssetManifest>(runId, "asset-manifest.json");
  const item = manifest.items.find((candidate) => candidate.id === assetId);
  if (!item) {
    throw new Error(`Asset not found: ${assetId}`);
  }
  if (item.kind !== "image" && item.kind !== "thumbnail" && item.kind !== "video") {
    throw new Error("이미지, 썸네일, 영상 항목만 제작 요청문을 수정할 수 있습니다.");
  }
  if (item.status === "generated") {
    throw new Error("이미 완료된 항목은 요청문 대신 새 파일을 등록하세요.");
  }

  item.prompt = prompt;
  if (item.status === "failed" || item.status === "skipped") {
    item.status = "pending_approval";
    item.error = "";
    item.actual_path = undefined;
    item.generated_at = undefined;
    item.request_id = undefined;
  }
  manifest.updated_at = new Date().toISOString();
  await writeRunJson(runId, "asset-manifest.json", manifest);
  await createGenerationQueue(runId);

  return {
    assetId,
    prompt,
  };
}
