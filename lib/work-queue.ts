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
    id: "operator-status-cli",
    phase: "Phase 5",
    title: "운영자 run id/큐 상태 CLI",
    status: "done",
    owner: "codex",
    canSkip: false,
    reason: "PowerShell에서 예시 플레이스홀더를 그대로 실행하지 않도록 실제 run id와 큐 상태를 보여줘야 합니다.",
    nextAction: "워커 실행 전 npm run ops:status -- --storage supabase로 실제 run id를 확인합니다.",
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
    id: "manual-provider-handoff",
    phase: "Phase 4",
    title: "수동 제공자 핸드오프 산출물",
    status: "done",
    owner: "codex",
    canSkip: false,
    reason: "직접 어댑터가 없는 제공자도 안전하게 외부 생성 후 다시 등록할 수 있어야 합니다.",
    nextAction: "우선순위 제공자가 확정되면 해당 API 직접 어댑터를 추가합니다.",
  },
  {
    id: "provider-adapter-depth",
    phase: "Phase 4",
    title: "선택형 생성/TTS 제공자 어댑터 확장",
    status: "skipped",
    owner: "codex",
    canSkip: true,
    reason:
      "설정 목록, 직접/수동/대기 표시, 수동 핸드오프가 준비되어 있어 현재 Phase를 막지 않습니다.",
    nextAction: "사용자가 우선 제공자를 확정하면 해당 API 직접 어댑터 작업으로 다시 엽니다.",
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
