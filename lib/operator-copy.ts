const fieldLabels: Record<string, string> = {
  angle: "영상 각도",
  brief: "기획 정보",
  claim_ledger: "주장 목록",
  format: "영상 형식",
  hook: "도입부",
  inclusion_reason: "선택 이유",
  language: "언어",
  media_prompts: "미디어 요청서",
  "media_prompts.image_prompts": "이미지 요청서",
  "media_prompts.video_prompts": "영상 요청서",
  outline: "대본 흐름",
  publishing_package: "업로드 글",
  qa: "검수 정보",
  "qa.blockers": "검수 확인 항목",
  "qa.status": "검수 상태",
  run_id: "실행 ID",
  script_plan: "대본 초안",
  "script_plan.outline": "대본 흐름",
  sources: "소스 영상",
  storyboard: "스토리보드",
  title: "제목",
  topic: "주제",
  url: "URL",
};

export function claimStatusCopy(status: string) {
  const labels: Record<string, string> = {
    do_not_use: "사용 금지",
    high_risk: "위험",
    needs_evidence: "근거 필요",
    opinion: "의견",
    supported: "근거 확인",
  };
  return labels[status] ?? status;
}

function fieldLabel(value: string) {
  const sourceItem = value.match(/^sources\[(\d+)\]$/i);
  if (sourceItem) return `${Number(sourceItem[1])}번째 소스`;
  const claimItem = value.match(/^claim_ledger\[(\d+)\]$/i);
  if (claimItem) return `${Number(claimItem[1])}번째 주장`;
  return fieldLabels[value] ?? value;
}

function listClaimRisk(needsEvidence: number, highRisk: number, doNotUse = 0) {
  const parts = [
    needsEvidence > 0 ? `근거 확인이 필요한 주장 ${needsEvidence}개` : "",
    highRisk > 0 ? `위험한 주장 ${highRisk}개` : "",
    doNotUse > 0 ? `사용 금지 주장 ${doNotUse}개` : "",
  ].filter(Boolean);
  return parts.length > 0 ? `${parts.join(", ")}가 남아 있습니다.` : "주장 목록을 다시 확인해야 합니다.";
}

export function operatorIssueCopy(value: string) {
  const text = value.trim();

  const unresolvedRisk = text.match(
    /^Claim ledger has unresolved risk:\s*(\d+)\s+needs_evidence,\s*(\d+)\s+high_risk(?:,\s*(\d+)\s+do_not_use)?\.?$/i,
  );
  if (unresolvedRisk) {
    return listClaimRisk(Number(unresolvedRisk[1]), Number(unresolvedRisk[2]), Number(unresolvedRisk[3] ?? 0));
  }

  const doNotUseRows = text.match(/^(\d+)\s+claim ledger rows are marked do_not_use/i);
  if (doNotUseRows) {
    return `사용 금지로 표시된 주장 ${Number(doNotUseRows[1])}개는 최종 대본에서 빼야 합니다.`;
  }

  const transcriptSlot = text.match(/^(\d+)\s+source video transcript slot is not filled yet\.?$/i);
  if (transcriptSlot) {
    return `소스 영상 ${Number(transcriptSlot[1])}개의 자막이나 스크립트가 아직 비어 있습니다.`;
  }

  const missingRequiredKey = text.match(/^(.+?) missing required key: (.+)$/i);
  if (missingRequiredKey) {
    return `${fieldLabel(missingRequiredKey[1])}에 ${fieldLabel(missingRequiredKey[2])} 항목이 없습니다.`;
  }

  const invalidClaimStatus = text.match(/^claim_ledger\[(\d+)\] has invalid status: (.+)$/i);
  if (invalidClaimStatus) {
    return `${Number(invalidClaimStatus[1])}번째 주장 상태가 올바르지 않습니다: ${claimStatusCopy(invalidClaimStatus[2])}`;
  }

  const objectFailure = text.match(/^(.+?) must be an object$/i);
  if (objectFailure) {
    return `${fieldLabel(objectFailure[1])} 형식이 올바르지 않습니다.`;
  }

  const arrayFailure = text.match(/^(.+?) must be an array$/i);
  if (arrayFailure) {
    return `${fieldLabel(arrayFailure[1])}은 목록 형식이어야 합니다.`;
  }

  const oneOfFailure = text.match(/^qa\.status must be one of (.+)$/i);
  if (oneOfFailure) {
    return "검수 상태 값이 올바르지 않습니다.";
  }

  const copy: Record<string, string> = {
    "01-research.md: add source videos through YouTube Finder or manual seed URLs.":
      "소스 영상 패널에서 YouTube 후보나 수동 URL을 추가하세요.",
    "03-claim-ledger.md: resolve, remove, or reframe unresolved claim rows before publishing.":
      "근거가 부족한 주장은 확인하거나, 삭제하거나, 질문형 표현으로 바꾸세요.",
    "03-claim-ledger.md: verify claims and mark at least one safe claim as supported.":
      "주장 목록에서 최소 1개 이상 근거 확인 완료로 표시하세요.",
    "04-script-plan.md: replace pending narration sections with a reviewed source-backed draft.":
      "대본 초안의 빈 자리 표시를 검토된 문장으로 바꾸세요.",
    "05-storyboard.md: draft and review scene cards before media generation.":
      "미디어를 만들기 전에 장면 카드를 먼저 작성하고 확인하세요.",
    "06-media-prompts.md: generate and review image/video prompts before paid generation.":
      "유료 생성 전에 이미지와 영상 제작 요청서를 먼저 확인하세요.",
    "07-publishing-package.md: draft title, description, tags, and thumbnail prompt.":
      "제목, 설명, 태그, 썸네일 문구 초안을 작성하세요.",
    "Add claims from analysis or transcript review.":
      "분석 결과나 자막 검토에서 확인할 주장을 추가하세요.",
    "Asset manifest is not built yet.": "만들 자료 목록이 아직 정리되지 않았습니다.",
    "Build asset-manifest.json before calling paid generation adapters.":
      "유료 생성 전에 만들 자료 목록을 먼저 정리하세요.",
    "Claim ledger is empty.": "주장 목록이 아직 비어 있습니다.",
    "Competitor video analysis is not complete.": "소스 영상 분석이 아직 끝나지 않았습니다.",
    "Human approval is required before generation or publishing.":
      "생성이나 게시 전에는 사람 승인이 필요합니다.",
    "Media prompts are not ready.": "이미지와 영상 제작 요청서가 아직 준비되지 않았습니다.",
    "No source videos are attached to the run.": "소스 영상이 아직 없습니다.",
    "No supported claims are recorded yet.": "근거 확인이 끝난 주장이 아직 없습니다.",
    "Paid generation, final render, and YouTube upload still require explicit human approval.":
      "유료 생성, 최종 렌더, YouTube 업로드는 사람 승인 후 진행해야 합니다.",
    "Publishing artifact is empty.": "업로드 글 초안이 아직 비어 있습니다.",
    "Publishing package is missing title candidates or description.":
      "제목 후보나 설명문이 아직 부족합니다.",
    "Script plan is only a bootstrap placeholder.": "대본 초안이 아직 기본 틀 상태입니다.",
    "Script plan still contains pending placeholders.": "대본 초안에 아직 빈 자리 표시가 남아 있습니다.",
    "Some image prompt records are not structured objects.":
      "일부 이미지 제작 요청서 형식이 올바르지 않습니다.",
    "Sources panel: add missing manual transcripts or document why transcript review is not required.":
      "소스 영상 패널에서 누락된 자막을 채우거나, 자막 검토가 필요 없는 이유를 남기세요.",
    "Storyboard and media prompts are not complete.": "스토리보드와 미디어 요청서가 아직 완성되지 않았습니다.",
    "Storyboard has no scene cards.": "스토리보드 장면 카드가 아직 없습니다.",
    "package must be an object": "제작 기록 형식이 올바르지 않습니다.",
    "sources must contain at least one source video": "소스 영상을 1개 이상 추가해야 합니다.",
  };

  return copy[text] ?? text;
}
