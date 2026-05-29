import { readRunFileIfExists, readRunJson, writeRunFile, writeRunJson } from "@/lib/run-store";
import type { ProductionPackage } from "@/lib/runs";

export type QaDraftResult = {
  status: "pass" | "blocked" | "needs_review";
  blockers: number;
  warnings: number;
  file: string;
};

function assertSafeRunId(runId: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error("Invalid run id.");
  }
}

function countClaimStatusFromPackage(pkg: ProductionPackage, status: string) {
  return pkg.claim_ledger.filter((claim) => {
    if (typeof claim !== "object" || claim === null) {
      return false;
    }
    return (claim as { status?: string }).status === status;
  }).length;
}

function countClaimStatusFromMarkdown(claimLedger: string, status: string) {
  return claimLedger
    .split(/\r?\n/)
    .filter((line) => line.startsWith("|") && line.toLowerCase().includes(`| ${status} |`))
    .length;
}

function countClaimStatus(pkg: ProductionPackage, claimLedger: string, status: string) {
  return Math.max(
    countClaimStatusFromPackage(pkg, status),
    countClaimStatusFromMarkdown(claimLedger, status),
  );
}

function countStoryboardScenes(storyboard: string) {
  return storyboard
    .split(/\r?\n/)
    .filter((line) => {
      if (!line.startsWith("| S")) {
        return false;
      }
      const [scene] = line.split("|").slice(1, -1).map((cell) => cell.trim());
      return /^S\d+/i.test(scene);
    }).length;
}

function hasPendingMarkers(content: string) {
  return /\bPending\b|대기|TODO/i.test(content);
}

function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasTranscript(source: ProductionPackage["sources"][number]) {
  return (
    source.transcript_status === "manual_transcript" ||
    source.transcript_status === "external_transcript" ||
    source.transcript_status === "stt_transcript" ||
    source.transcript_status === "available"
  );
}

function bulletList(items: string[]) {
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- 없음";
}

function qaStatusCopy(status: "pass" | "blocked" | "needs_review") {
  const labels = {
    blocked: "검토 및 승인 대기",
    needs_review: "검토 필요",
    pass: "통과",
  };
  return labels[status];
}

function publishReadinessCopy(value: "not ready" | "render-only ready") {
  return value === "not ready" ? "아직 준비 안 됨" : "렌더 준비 가능";
}

export async function createQaDraft(runId: string): Promise<QaDraftResult> {
  assertSafeRunId(runId);
  const pkg = await readRunJson<ProductionPackage>(runId, "production-package.json");
  const [claimLedger, scriptPlan, storyboard, mediaPrompts, publishingPackage] = await Promise.all([
    readRunFileIfExists(runId, "03-claim-ledger.md").then((value) => value ?? ""),
    readRunFileIfExists(runId, "04-script-plan.md").then((value) => value ?? ""),
    readRunFileIfExists(runId, "05-storyboard.md").then((value) => value ?? ""),
    readRunFileIfExists(runId, "06-media-prompts.md").then((value) => value ?? ""),
    readRunFileIfExists(runId, "07-publishing-package.md").then((value) => value ?? ""),
  ]);

  const supported = countClaimStatus(pkg, claimLedger, "supported");
  const needsEvidence = countClaimStatus(pkg, claimLedger, "needs_evidence");
  const highRisk = countClaimStatus(pkg, claimLedger, "high_risk");
  const doNotUse = countClaimStatus(pkg, claimLedger, "do_not_use");
  const storyboardScenes = Math.max(pkg.storyboard.length, countStoryboardScenes(storyboard));
  const imagePrompts = pkg.media_prompts.image_prompts?.length ?? 0;
  const videoPrompts = pkg.media_prompts.video_prompts?.length ?? 0;
  const assetManifestItems = pkg.asset_manifest?.items ?? 0;
  const titleCount = pkg.publishing_package.title_candidates?.length ?? 0;
  const missingTranscriptCount = pkg.sources.filter(
    (source) => !source.analysis_excluded && !hasTranscript(source),
  ).length;

  const blockers: string[] = [];
  const warnings: string[] = [];
  const fixList: string[] = [];

  if (pkg.sources.length === 0) {
    blockers.push("소스 영상이 아직 없습니다.");
    fixList.push("소스 영상 패널에서 YouTube 후보나 수동 URL을 추가하세요.");
  }

  if (supported === 0) {
    blockers.push("근거 확인이 끝난 주장이 아직 없습니다.");
    fixList.push("주장 목록에서 최소 1개 이상 근거 확인 완료로 표시하세요.");
  }

  if (needsEvidence > 0 || highRisk > 0) {
    const parts = [
      needsEvidence > 0 ? `근거 확인이 필요한 주장 ${needsEvidence}개` : "",
      highRisk > 0 ? `위험한 주장 ${highRisk}개` : "",
    ].filter(Boolean);
    blockers.push(`${parts.join(", ")}가 남아 있습니다.`);
    fixList.push("근거가 부족한 주장은 확인하거나, 삭제하거나, 질문형 표현으로 바꾸세요.");
  }

  if (doNotUse > 0) {
    warnings.push(`사용 금지로 표시된 주장 ${doNotUse}개는 최종 대본에서 빼야 합니다.`);
  }

  if (hasPendingMarkers(scriptPlan)) {
    blockers.push("대본 초안에 아직 빈 자리 표시가 남아 있습니다.");
    fixList.push("대본 초안의 빈 자리 표시를 검토된 문장으로 바꾸세요.");
  }

  if (storyboardScenes === 0) {
    blockers.push("스토리보드 장면 카드가 아직 없습니다.");
    fixList.push("미디어를 만들기 전에 장면 카드를 먼저 작성하고 확인하세요.");
  }

  if (imagePrompts + videoPrompts === 0 || mediaPrompts.trim().length === 0) {
    blockers.push("이미지와 영상 에셋 생성 요청서가 아직 준비되지 않았습니다.");
    fixList.push("유료 생성 전에 이미지와 영상 에셋 생성 요청서를 먼저 확인하세요.");
  }

  if (imagePrompts + videoPrompts > 0 && assetManifestItems === 0) {
    warnings.push("만들 자료 목록이 아직 정리되지 않았습니다.");
    fixList.push("유료 생성 전에 만들 자료 목록을 먼저 정리하세요.");
  }

  if (titleCount === 0 || !hasText(pkg.publishing_package.description)) {
    blockers.push("제목 후보나 설명문이 아직 부족합니다.");
    fixList.push("제목, 설명, 태그, 썸네일 문구 초안을 작성하세요.");
  }

  if (publishingPackage.trim().length === 0) {
    blockers.push("메타데이터 초안이 아직 비어 있습니다.");
  }

  if (missingTranscriptCount > 0) {
    warnings.push(`소스 영상 ${missingTranscriptCount}개의 자막이나 스크립트가 아직 비어 있습니다.`);
    fixList.push("소스 영상 패널에서 누락된 자막을 채우거나, 자막 검토가 필요 없는 이유를 남기세요.");
  }

  if (pkg.media_prompts.image_prompts?.some((prompt) => typeof prompt !== "object")) {
    warnings.push("일부 이미지 제작 요청서 형식이 올바르지 않습니다.");
  }

  warnings.push("유료 생성, 최종 렌더, YouTube 업로드는 사람 승인 후 진행해야 합니다.");

  const status: "pass" | "blocked" | "needs_review" =
    blockers.length > 0 ? "blocked" : pkg.qa.approval_required === false ? "pass" : "needs_review";
  const publishReadiness = blockers.length > 0 ? "not ready" : "render-only ready";
  const approvalChecklist = [
    "소스 범위와 자막 상태를 확인했습니다.",
    "주장 상태와 최종 내레이션 표현을 확인했습니다.",
    "이미지, 영상, 음성 생성 비용 사용을 승인합니다.",
    "썸네일, 제목, 설명, 태그를 확인했습니다.",
    "최종 업로드나 예약 게시를 승인합니다.",
  ];

  pkg.qa = {
    ...pkg.qa,
    status,
    blockers,
    approval_required: true,
    warnings,
    fix_list: fixList,
    approval_checklist: approvalChecklist,
    publish_readiness: publishReadiness,
  } as ProductionPackage["qa"];

  const markdown = `# 08 검수 메모

제작 기록과 산출물을 기준으로 자동 확인한 결과입니다.

## 상태

- 현재 상태: ${qaStatusCopy(status)}
- 업로드 준비: ${publishReadinessCopy(publishReadiness)}
- 사람 승인: 필요

## 지금 해결할 항목

${bulletList(blockers)}

## 주의할 항목

${bulletList(warnings)}

## 정리 방법

${bulletList(fixList)}

## 승인 체크리스트

${approvalChecklist.map((item) => `- [ ] ${item}`).join("\n")}

## 범위 요약

- 소스 영상: ${pkg.sources.length}
- 자막 미확인: ${missingTranscriptCount}
- 근거 확인 주장: ${supported}
- 근거 필요 주장: ${needsEvidence}
- 위험 주장: ${highRisk}
- 사용 금지 주장: ${doNotUse}
- 스토리보드 장면: ${storyboardScenes}
- 이미지 요청서: ${imagePrompts}
- 영상 요청서: ${videoPrompts}
- 만들 자료: ${assetManifestItems}
- 제목 후보: ${titleCount}

## 운영 원칙

- 해결할 항목이 남아 있으면 게시하지 않습니다.
- 유료 생성, 렌더, 업로드, 예약 게시는 사람 승인 없이 실행하지 않습니다.
- 최종 게시 전 소스 링크, 시간, 모델 선택, 비용 기록을 제작 실행에 남깁니다.
`;

  await Promise.all([
    writeRunFile(runId, "08-qa.md", markdown),
    writeRunJson(runId, "production-package.json", pkg),
  ]);

  return {
    status,
    blockers: blockers.length,
    warnings: warnings.length,
    file: "08-qa.md",
  };
}
