import { readRunFileIfExists, readRunJson, writeRunFile, writeRunJson } from "@/lib/run-store";
import type { ProductionPackage } from "@/lib/runs";

export type PublishingDraftResult = {
  titles: number;
  tags: number;
  file: string;
};

function assertSafeRunId(runId: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error("Invalid run id.");
  }
}

function extractClaimStatusCount(claimLedger: string, status: string) {
  return claimLedger
    .split(/\r?\n/)
    .filter((line) => line.startsWith("|") && line.toLowerCase().includes(`| ${status} |`))
    .length;
}

function compactTopic(topic: string) {
  return topic.trim().replace(/\s+/g, " ");
}

function buildTitleCandidates(pkg: ProductionPackage) {
  const topic = compactTopic(pkg.brief.topic);
  const category = pkg.brief.category ?? "콘텐츠";
  const isShorts = pkg.brief.format === "shorts";

  return [
    `${topic}, 시작 전에 꼭 확인할 3가지`,
    `상위 영상에서 반복되는 ${topic} 패턴`,
    `${topic}: 따라 하기 전에 봐야 할 체크리스트`,
    `${topic} 콘텐츠를 더 안전하게 만드는 순서`,
    isShorts ? `${topic} 60초 핵심 정리` : `${topic} 완성 전 점검해야 할 것들`,
    `${category} 분야 크리에이터가 놓치기 쉬운 ${topic} 기준`,
  ];
}

function buildTags(pkg: ProductionPackage) {
  const tags = new Set<string>();
  const topic = compactTopic(pkg.brief.topic);
  const category = pkg.brief.category?.trim();

  tags.add(topic);
  if (category) {
    tags.add(category);
  }
  tags.add(pkg.brief.format);
  tags.add(pkg.brief.language);
  tags.add("유튜브 자동화");
  tags.add("콘텐츠 기획");
  tags.add("AI 도구");
  tags.add("팩트체크");
  tags.add("스토리보드");
  tags.add("생성형 AI");

  return Array.from(tags).slice(0, 12);
}

function buildDescription(pkg: ProductionPackage, needsEvidenceCount: number) {
  const topic = compactTopic(pkg.brief.topic);
  const audience = pkg.brief.target_audience ?? "콘텐츠 제작자";
  const evidenceNote =
    needsEvidenceCount > 0
      ? `\n\n검수 메모: 현재 ${needsEvidenceCount}개 항목은 추가 근거 확인이 필요하므로, 최종 업로드 전 표현을 재검토해야 합니다.`
      : "";

  return `이번 영상은 ${topic}에 대해 ${audience}가 바로 점검할 수 있는 흐름을 정리합니다.

다룹니다:
- 상위 콘텐츠에서 반복되는 구조
- 주장과 의견을 구분하는 체크포인트
- 대본, 스토리보드, 미디어 생성 전 확인할 기준

이 설명문은 자동 초안입니다. 최종 업로드 전 출처, 사실관계, 저작권, 썸네일 문구를 다시 승인하세요.${evidenceNote}`;
}

function buildThumbnailPrompt(pkg: ProductionPackage) {
  const topic = compactTopic(pkg.brief.topic);
  return [
    `Create a ${pkg.brief.format === "shorts" ? "9:16 cover frame" : "16:9 YouTube thumbnail"} for "${topic}".`,
    "Use one strong focal object, one short Korean phrase, and a clean evidence/checklist motif.",
    "Keep the layout original, readable on mobile, high contrast, and free of copied competitor composition.",
    "Avoid celebrity likeness, protected logos, misleading charts, and unsupported factual claims.",
  ].join(" ");
}

export async function createPublishingDraft(runId: string): Promise<PublishingDraftResult> {
  assertSafeRunId(runId);
  const pkg = await readRunJson<ProductionPackage>(runId, "production-package.json");
  const [scriptPlan, mediaPrompts, claimLedger] = await Promise.all([
    readRunFileIfExists(runId, "04-script-plan.md").then((value) => value ?? ""),
    readRunFileIfExists(runId, "06-media-prompts.md").then((value) => value ?? ""),
    readRunFileIfExists(runId, "03-claim-ledger.md").then((value) => value ?? ""),
  ]);

  const needsEvidenceCount = extractClaimStatusCount(claimLedger, "needs_evidence");
  const titleCandidates = buildTitleCandidates(pkg);
  const tags = buildTags(pkg);
  const description = buildDescription(pkg, needsEvidenceCount);
  const thumbnailPrompt = buildThumbnailPrompt(pkg);

  pkg.publishing_package = {
    ...pkg.publishing_package,
    title_candidates: titleCandidates,
    description,
    tags,
    thumbnail_prompt: thumbnailPrompt,
  };

  const markdown = `# 07 Publishing Package

Generated deterministic starter upload package from brief, script plan, and media prompts.

## Title Candidates

${titleCandidates.map((title, index) => `${index + 1}. ${title}`).join("\n")}

## Description Draft

${description}

## Tags

${tags.map((tag) => `- ${tag}`).join("\n")}

## Thumbnail Prompt

${thumbnailPrompt}

## Packaging Context

- Topic: ${pkg.brief.topic}
- Format: ${pkg.brief.format}
- Language: ${pkg.brief.language}
- Source videos: ${pkg.sources.length}
- Needs-evidence claim rows: ${needsEvidenceCount}

## Script Snapshot

${scriptPlan.slice(0, 1500) || "Script plan not available yet."}

## Media Prompt Snapshot

${mediaPrompts.slice(0, 1500) || "Media prompts not available yet."}

## Upload Checklist

- [ ] Title does not overpromise beyond supported claims.
- [ ] Description contains no unsupported factual claim.
- [ ] Tags are relevant and not spammy.
- [ ] Thumbnail phrase matches the actual hook.
- [ ] Human approval granted before upload or scheduling.
`;

  await Promise.all([
    writeRunFile(runId, "07-publishing-package.md", markdown),
    writeRunJson(runId, "production-package.json", pkg),
  ]);

  return {
    titles: titleCandidates.length,
    tags: tags.length,
    file: "07-publishing-package.md",
  };
}
