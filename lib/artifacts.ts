import {
  getRunFileInfo,
  readRunFileIfExists,
  runExists,
  writeRunFile,
} from "@/lib/run-store";

export type ArtifactDefinition = {
  id: string;
  filename: string;
  label: string;
  skill: string;
  description: string;
};

export type RunArtifact = ArtifactDefinition & {
  content: string;
  updatedAt: string;
  size: number;
};

const maxArtifactBytes = 300_000;

export const artifactDefinitions: ArtifactDefinition[] = [
  {
    id: "research",
    filename: "01-research.md",
    label: "리서치",
    skill: "youtube-market-research",
    description: "소스 테이블, 리서치 요약, 조사할 패턴입니다.",
  },
  {
    id: "video-analysis",
    filename: "02-video-analysis.md",
    label: "영상 분석",
    skill: "youtube-video-analysis",
    description: "경쟁 영상 분석, 훅 라이브러리, 구조 패턴, 클레임 후보입니다.",
  },
  {
    id: "claim-ledger",
    filename: "03-claim-ledger.md",
    label: "클레임 장부",
    skill: "youtube-fact-check",
    description: "상태, 근거, 신뢰도, 조치가 포함된 팩트체크 표입니다.",
  },
  {
    id: "script-patterns",
    filename: "02-script-patterns.md",
    label: "대본 유형",
    skill: "youtube-video-analysis",
    description: "TOP10 훅, 첫 30초, 전개, retention, CTA 패턴 분석입니다.",
  },
  {
    id: "script-plan",
    filename: "04-script-plan.md",
    label: "대본 구성",
    skill: "youtube-script-architect",
    description: "전략, 훅 후보, 비트맵, 내레이션 초안입니다.",
  },
  {
    id: "strategy-recommendations",
    filename: "04-strategy-recommendations.md",
    label: "전략 추천",
    skill: "youtube-script-architect",
    description: "TOP10 기반 대상 시청자, 톤, 각도, 대본 구조 추천입니다.",
  },
  {
    id: "storyboard",
    filename: "05-storyboard.md",
    label: "스토리보드",
    skill: "youtube-storyboard",
    description: "씬 카드, 시각 계획, 필요한 자산, 편집 메모입니다.",
  },
  {
    id: "media-prompts",
    filename: "06-media-prompts.md",
    label: "미디어 프롬프트",
    skill: "youtube-media-prompts",
    description: "스타일 바이블, 이미지/영상/썸네일 프롬프트입니다.",
  },
  {
    id: "publishing",
    filename: "07-publishing-package.md",
    label: "배포 패키지",
    skill: "youtube-production-qa",
    description: "제목 후보, 설명문, 태그, 썸네일, 업로드 체크리스트입니다.",
  },
  {
    id: "qa",
    filename: "08-qa.md",
    label: "검수",
    skill: "youtube-production-qa",
    description: "차단 항목, 경고, 승인 체크리스트, 배포 준비 상태입니다.",
  },
  {
    id: "render-edl",
    filename: "render-edl.json",
    label: "렌더 EDL",
    skill: "render-worker",
    description: "씬, 오디오, 자막, 화면 문구를 묶은 편집 결정 목록입니다.",
  },
  {
    id: "youtube-upload-job",
    filename: "youtube-upload-job.json",
    label: "업로드 작업",
    skill: "youtube-upload-worker",
    description: "채널, 메타데이터, 공개 상태, 예약, 워커 명령을 담은 YouTube 업로드 작업입니다.",
  },
  {
    id: "performance-snapshot",
    filename: "09-performance-snapshot.md",
    label: "성과 스냅샷",
    skill: "feedback-loop",
    description: "YouTube 공개 지표와 가능한 Analytics 지표를 저장한 성과 스냅샷입니다.",
  },
  {
    id: "feedback-insights",
    filename: "10-feedback-insights.md",
    label: "피드백 인사이트",
    skill: "feedback-loop",
    description: "성과 신호, CTR/retention 해석, 다음 추천 액션입니다.",
  },
  {
    id: "ab-learning-log",
    filename: "11-ab-learning-log.md",
    label: "A/B 학습",
    skill: "feedback-loop",
    description: "제목, 썸네일, 훅 변형과 측정 계획입니다.",
  },
  {
    id: "channel-memory-update",
    filename: "12-channel-memory-update.md",
    label: "채널 메모리",
    skill: "feedback-loop",
    description: "다음 제작에 가져갈 패턴과 주의 플래그입니다.",
  },
];

function assertSafeRunId(runId: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error("Invalid run id.");
  }
}

function getArtifactDefinition(artifactId: string) {
  const definition = artifactDefinitions.find((artifact) => artifact.id === artifactId);
  if (!definition) {
    throw new Error("Unknown artifact.");
  }
  return definition;
}

async function ensureRunExists(runId: string) {
  if (!(await runExists(runId))) {
    throw new Error("Run not found.");
  }
}

export async function getRunArtifacts(runId: string): Promise<RunArtifact[]> {
  assertSafeRunId(runId);
  await ensureRunExists(runId);

  return Promise.all(
    artifactDefinitions.map(async (definition) => {
      const [content, info] = await Promise.all([
        readRunFileIfExists(runId, definition.filename),
        getRunFileInfo(runId, definition.filename),
      ]);

      return {
        ...definition,
        content: content ?? "",
        updatedAt: info?.updatedAt ?? "",
        size: info?.size ?? 0,
      };
    }),
  );
}

export async function getRunArtifact(runId: string, artifactId: string): Promise<RunArtifact> {
  assertSafeRunId(runId);
  await ensureRunExists(runId);

  const definition = getArtifactDefinition(artifactId);
  const [content, info] = await Promise.all([
    readRunFileIfExists(runId, definition.filename),
    getRunFileInfo(runId, definition.filename),
  ]);

  return {
    ...definition,
    content: content ?? "",
    updatedAt: info?.updatedAt ?? "",
    size: info?.size ?? 0,
  };
}

export async function updateRunArtifact(runId: string, artifactId: string, content: string) {
  assertSafeRunId(runId);
  await ensureRunExists(runId);

  const definition = getArtifactDefinition(artifactId);
  const bytes = Buffer.byteLength(content, "utf-8");
  if (bytes > maxArtifactBytes) {
    throw new Error(`Artifact is too large. Max size is ${maxArtifactBytes} bytes.`);
  }

  await writeRunFile(runId, definition.filename, content);

  return getRunArtifact(runId, artifactId);
}
