import type { RunApprovals } from "@/lib/approvals";
import type { AssetGenerationState } from "@/lib/asset-generation-state";
import type { PackageValidationResult } from "@/lib/package-validation";
import type { ProductionPackage } from "@/lib/runs";
import type { RunWorkerStatus } from "@/lib/worker-status";

export type RunNextActionStatus = "done" | "review" | "blocked" | "pending";

export type RunNextActionItem = {
  title: string;
  detail: string;
  status: RunNextActionStatus;
  command?: string;
};

export type RunNextActionPlan = {
  headline: string;
  detail: string;
  status: RunNextActionStatus;
  items: RunNextActionItem[];
};

function approvalReady(approval: RunApprovals[keyof RunApprovals]) {
  return approval.approved === true && approval.approved_by.trim() !== "" && approval.approved_at.trim() !== "";
}

function promptCount(pkg: ProductionPackage) {
  return (pkg.media_prompts.image_prompts?.length ?? 0) + (pkg.media_prompts.video_prompts?.length ?? 0);
}

function firstFailures(validation: PackageValidationResult) {
  return validation.failures.slice(0, 3).map((failure) => ({
    detail: failure,
    status: "blocked" as const,
    title: "구조 실패",
  }));
}

export function getRunNextActionPlan({
  approvals,
  generationState,
  pkg,
  storageMode,
  validation,
  workerStatus,
}: {
  approvals: RunApprovals;
  generationState: AssetGenerationState;
  pkg: ProductionPackage;
  storageMode: string;
  validation: PackageValidationResult;
  workerStatus: RunWorkerStatus;
}): RunNextActionPlan {
  if (validation.status === "fail") {
    return {
      detail: `${validation.failures.length}개 구조 문제가 남아 있습니다.`,
      headline: "패키지 구조 보정",
      items: firstFailures(validation),
      status: "blocked",
    };
  }

  if (pkg.sources.length === 0) {
    return {
      detail: "소스 영상이 있어야 분석, 대본, 검수 흐름이 안정적으로 이어집니다.",
      headline: "소스 영상 수집",
      items: [
        {
          detail: "유튜브 파인더에서 후보를 검색한 뒤 선택한 결과를 run 소스로 가져오세요.",
          status: "pending",
          title: "유튜브 파인더",
        },
      ],
      status: "pending",
    };
  }

  if (
    pkg.claim_ledger.length === 0 ||
    pkg.script_plan.outline.length === 0 ||
    pkg.storyboard.length === 0 ||
    promptCount(pkg) === 0 ||
    (pkg.publishing_package.title_candidates?.length ?? 0) === 0
  ) {
    return {
      detail: "분석부터 검수 초안까지 한 번에 채워 제작 패키지의 기본 뼈대를 만듭니다.",
      headline: "초안 전체 실행",
      items: [
        {
          detail: "상단의 초안 전체 실행 버튼으로 분석, 대본, 스토리보드, 미디어, 배포, 검수를 생성하세요.",
          status: "pending",
          title: "초안 파이프라인",
        },
      ],
      status: "pending",
    };
  }

  if (pkg.qa.status === "blocked" || pkg.qa.blockers.length > 0) {
    return {
      detail: `${pkg.qa.blockers.length}개 검수 차단 항목이 남아 있습니다.`,
      headline: "검수 차단 항목 해결",
      items: pkg.qa.blockers.slice(0, 3).map((blocker) => ({
        detail: blocker,
        status: "blocked",
        title: "차단 항목",
      })),
      status: "blocked",
    };
  }

  if (!approvalReady(approvals.generation)) {
    return {
      detail: "이미지, 영상, TTS, 자막, BGM 생성 전에 generation 승인이 필요합니다.",
      headline: "생성 승인",
      items: [
        {
          detail: "오른쪽 승인 게이트에서 generation을 승인하고 승인자를 남기세요.",
          status: "review",
          title: "승인 게이트",
        },
      ],
      status: "review",
    };
  }

  if (!generationState.manifestExists || !pkg.asset_manifest) {
    return {
      detail: "스토리보드와 미디어 프롬프트를 생성 가능한 자산 목록으로 변환합니다.",
      headline: "자산 매니페스트 생성",
      items: [
        {
          detail: "상단의 자산 버튼으로 image, video, voice, subtitle, thumbnail 항목을 정리하세요.",
          status: "pending",
          title: "자산 목록",
        },
      ],
      status: "pending",
    };
  }

  if (!generationState.queueExists) {
    return {
      detail: "승인, 제공자 설정, 프롬프트 상태를 반영해 실제 생성 가능한 항목을 나눕니다.",
      headline: "생성 대기열 준비",
      items: [
        {
          detail: "상단의 생성 대기열 버튼으로 ready, blocked, skipped 항목을 확정하세요.",
          status: "pending",
          title: "대기열 프리플라이트",
        },
      ],
      status: "pending",
    };
  }

  if ((generationState.summary?.blocked ?? 0) > 0) {
    return {
      detail: `${generationState.summary?.blocked ?? 0}개 생성 항목이 제공자 설정, 승인, 프롬프트 문제로 막혀 있습니다.`,
      headline: "생성 대기열 차단 해소",
      items: generationState.items
        .filter((item) => item.blockers.length > 0)
        .slice(0, 3)
        .map((item) => ({
          detail: item.blockers.join(", "),
          status: "blocked" as const,
          title: item.id,
        })),
      status: "blocked",
    };
  }

  if ((generationState.summary?.ready ?? 0) > 0) {
    return {
      detail: `${generationState.summary?.ready ?? 0}개 자산이 생성 또는 수동 등록을 기다립니다.`,
      headline: "자산 생성",
      items: [
        {
          detail: "생성 콘솔에서 직접 생성하거나 수동 핸드오프 후 결과 파일을 등록하세요.",
          status: "pending",
          title: "미디어 자산",
        },
      ],
      status: "pending",
    };
  }

  if (!approvalReady(approvals.render)) {
    return {
      detail: "최종 조립과 로컬 ffmpeg 렌더 전에 render 승인이 필요합니다.",
      headline: "렌더 승인",
      items: [
        {
          detail: "오른쪽 승인 게이트에서 render를 승인하고 승인자를 남기세요.",
          status: "review",
          title: "승인 게이트",
        },
      ],
      status: "review",
    };
  }

  if (!pkg.render_manifest) {
    return {
      detail: "생성된 자산을 타임라인으로 묶어 렌더 가능성을 확인합니다.",
      headline: "렌더 매니페스트 생성",
      items: [
        {
          detail: "상단의 렌더 매니페스트 버튼으로 최종 조립 조건을 확인하세요.",
          status: "pending",
          title: "렌더 프리플라이트",
        },
      ],
      status: "pending",
    };
  }

  if (pkg.render_manifest.blockers > 0 || !pkg.render_manifest.render_ready) {
    return {
      detail: `${pkg.render_manifest.blockers}개 렌더 차단 항목이 남아 있습니다.`,
      headline: "렌더 차단 해소",
      items: [
        {
          detail: "누락된 영상, 음성, 자막, BGM 자산을 등록한 뒤 렌더 매니페스트를 다시 생성하세요.",
          status: "blocked",
          title: "렌더 입력",
        },
      ],
      status: "blocked",
    };
  }

  if (workerStatus.render.status === "queued") {
    return {
      detail: "렌더 작업이 큐에 등록되어 외부 워커 실행을 기다립니다.",
      headline: "렌더 워커 실행",
      items: [
        {
          command: `npm run render:worker -- --next --confirm RUN_RENDER_WORKER --storage ${storageMode}`,
          detail: "로컬 또는 별도 워커 환경에서 실행하세요.",
          status: "pending",
          title: "워커 명령",
        },
      ],
      status: "pending",
    };
  }

  if (workerStatus.render.status !== "completed") {
    return {
      detail: "렌더 준비가 끝났습니다. 큐 작업을 만들거나 로컬 렌더를 실행할 수 있습니다.",
      headline: "렌더 작업 생성",
      items: [
        {
          detail: "상단의 렌더 작업 버튼으로 외부 워커 큐를 만들거나 로컬 렌더 버튼으로 MVP 렌더를 실행하세요.",
          status: "pending",
          title: "렌더 실행",
        },
      ],
      status: "pending",
    };
  }

  if (!pkg.publishing_handoff?.ready) {
    return {
      detail: "최종 파일, 썸네일, 제목, 설명, 태그를 업로드 패키지로 잠급니다.",
      headline: "배포 핸드오프 생성",
      items: [
        {
          detail: "상단의 배포 핸드오프 버튼으로 업로드 전 체크리스트를 생성하세요.",
          status: "pending",
          title: "배포 패키지",
        },
      ],
      status: "pending",
    };
  }

  if (!approvalReady(approvals.publish)) {
    return {
      detail: "YouTube 업로드나 예약 게시 전에 publish 승인이 필요합니다.",
      headline: "게시 승인",
      items: [
        {
          detail: "오른쪽 승인 게이트에서 publish를 승인하고 승인자를 남기세요.",
          status: "review",
          title: "승인 게이트",
        },
      ],
      status: "review",
    };
  }

  if (workerStatus.upload.status === "queued") {
    return {
      detail: "업로드 작업이 큐에 등록되어 외부 워커 실행을 기다립니다.",
      headline: "YouTube 업로드 워커 실행",
      items: [
        {
          command: `npm run youtube:upload-worker -- --next --confirm RUN_YOUTUBE_UPLOAD --storage ${storageMode}`,
          detail: "OAuth refresh token은 youtube.upload scope가 있어야 합니다.",
          status: "pending",
          title: "워커 명령",
        },
      ],
      status: "pending",
    };
  }

  if (workerStatus.upload.status !== "completed") {
    return {
      detail: "업로드 전 패키지가 준비됐습니다. 업로드 작업 큐를 만들 수 있습니다.",
      headline: "YouTube 업로드 작업 생성",
      items: [
        {
          detail: "상단의 YouTube 업로드 작업 버튼으로 큐를 등록하세요.",
          status: "pending",
          title: "업로드 큐",
        },
      ],
      status: "pending",
    };
  }

  return {
    detail: pkg.publishing_handoff?.uploaded_video_url ?? "업로드 로그가 완료 상태입니다.",
    headline: "업로드 완료",
    items: [
      {
        detail: "피드백 루프에서 공개 지표를 수집하고 다음 콘텐츠 메모리로 반영하세요.",
        status: "done",
        title: "피드백 루프",
      },
    ],
    status: "done",
  };
}
