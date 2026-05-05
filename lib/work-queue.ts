export type WorkQueueStatus = "done" | "next" | "deferred" | "skipped";

export type WorkQueueOwner = "codex" | "operator" | "external";

export type WorkQueueItem = {
  id: string;
  phase: string;
  title: string;
  status: WorkQueueStatus;
  owner: WorkQueueOwner;
  canSkip: boolean;
  reason: string;
  nextAction: string;
};

export type WorkQueueSummary = {
  total: number;
  done: number;
  next: number;
  deferred: number;
  skipped: number;
  codexReady: number;
  externalBlocked: number;
  nextItem: WorkQueueItem | null;
};

export const workQueueStatusCopy: Record<WorkQueueStatus, string> = {
  done: "완료",
  next: "다음",
  deferred: "보류",
  skipped: "건너뜀",
};

export const phaseWorkQueue: WorkQueueItem[] = [
  {
    id: "phase-6-feedback-loop-flow",
    phase: "Phase 6",
    title: "피드백 루프 일괄 실행",
    status: "done",
    owner: "codex",
    canSkip: false,
    reason: "스냅샷, 인사이트, A/B 로그, 채널 메모리를 한 번에 실행하는 버튼이 필요했습니다.",
    nextAction: "프로덕션 배포 후 실제 영상 ID로 한 번 실행해 동작을 확인합니다.",
  },
  {
    id: "phase-6-work-queue",
    phase: "Phase 6",
    title: "작업/보류 큐 기준 고정",
    status: "done",
    owner: "codex",
    canSkip: false,
    reason: "반복 작업 중 건너뛴 항목과 외부 의존 항목을 잃지 않기 위한 운영 기준입니다.",
    nextAction: "다음 Codex-owned 작업부터 이 큐를 기준으로 완료, 보류, 건너뜀을 분리합니다.",
  },
  {
    id: "youtube-analytics-oauth",
    phase: "Phase 6",
    title: "YouTube Analytics CTR/시청지속시간 연동",
    status: "deferred",
    owner: "operator",
    canSkip: false,
    reason:
      "공개 YouTube Data API 지표는 구현되어 있지만 CTR, 시청지속시간, 유입 경로는 YouTube Analytics OAuth 권한이 필요합니다.",
    nextAction:
      "Google Cloud에서 YouTube Analytics API를 활성화하고 analytics.readonly 권한으로 refresh token을 발급합니다.",
  },
  {
    id: "external-render-upload-workers",
    phase: "Phase 5",
    title: "외부 렌더/업로드 워커 상시 실행",
    status: "deferred",
    owner: "external",
    canSkip: false,
    reason:
      "Vercel 서버리스 안에서 ffmpeg 렌더링과 OAuth 업로드를 상시 처리하면 안정성과 실행 시간 문제가 생깁니다.",
    nextAction: "별도 워커 환경에서 render/upload worker poll 모드를 서비스로 실행합니다.",
  },
  {
    id: "provider-capability-labels",
    phase: "Phase 4",
    title: "제공자 직접/수동/대기 표시",
    status: "done",
    owner: "codex",
    canSkip: false,
    reason: "선택 가능한 제공자와 즉시 자동화 가능한 제공자가 화면에서 구분되어야 합니다.",
    nextAction: "실제 API 어댑터는 사용자가 우선 제공자를 선택한 뒤 깊게 붙입니다.",
  },
  {
    id: "provider-adapter-depth",
    phase: "Phase 4",
    title: "선택형 생성/TTS 제공자 어댑터 확장",
    status: "next",
    owner: "codex",
    canSkip: true,
    reason:
      "현재 설정 목록과 일부 어댑터가 준비되어 있고, 추가 제공자는 사용자가 선택하는 모델부터 깊게 붙이는 편이 안전합니다.",
    nextAction: "fal.ai 영상, Inworld/OpenAI TTS 이후 Supertone, AIVIS, 기타 선택 제공자를 어댑터로 확장합니다.",
  },
];

export function getWorkQueueSummary(items = phaseWorkQueue): WorkQueueSummary {
  const nextItems = items.filter((item) => item.status === "next");
  const externalBlocked = items.filter(
    (item) => item.status === "deferred" && item.owner !== "codex",
  ).length;
  return {
    total: items.length,
    done: items.filter((item) => item.status === "done").length,
    next: nextItems.length,
    deferred: items.filter((item) => item.status === "deferred").length,
    skipped: items.filter((item) => item.status === "skipped").length,
    codexReady: nextItems.filter((item) => item.owner === "codex").length,
    externalBlocked,
    nextItem: nextItems[0] ?? null,
  };
}
