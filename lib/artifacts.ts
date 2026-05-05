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
    id: "script-plan",
    filename: "04-script-plan.md",
    label: "대본 구성",
    skill: "youtube-script-architect",
    description: "전략, 훅 후보, 비트맵, 내레이션 초안입니다.",
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
