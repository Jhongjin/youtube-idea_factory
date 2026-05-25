import { listRunSummaries } from "@/lib/run-store";

export type SourceVideo = {
  rank?: number;
  url: string;
  title: string;
  channel?: string;
  channel_id?: string;
  comment_count?: number;
  description?: string;
  duration?: string;
  duration_seconds?: number;
  like_count?: number;
  metadata_status?: string;
  search_published_after?: string;
  search_query?: string;
  search_scope?: string;
  source_mode?: string;
  thumbnail_url?: string;
  view_count?: number;
  published_at?: string;
  analysis_excluded?: boolean;
  analysis_exclusion_reason?: string;
  inclusion_reason: string;
  transcript_status?: string;
  video_id?: string;
};

export type ProductionRunChannel = {
  brand_name: string;
  channel_id?: string | null;
  channel_name: string;
  default_language?: string;
  id: string;
  status?: string;
  youtube_handle?: string | null;
};

export type ProductionPackage = {
  run_id: string;
  brief: {
    topic: string;
    category?: string;
    category_id?: string;
    channel?: ProductionRunChannel;
    format: string;
    target_audience?: string;
    target_duration_seconds?: number;
    language: string;
    region_code?: string;
    source_mode?: string;
    source_candidate_limit?: number;
    source_lookback_days?: number;
    tone?: string;
  };
  sources: SourceVideo[];
  claim_ledger: unknown[];
  script_plan: {
    angle: string;
    hook: string;
    outline: string[];
    notes?: string;
  };
  storyboard: unknown[];
  media_prompts: {
    style_bible?: string;
    image_prompts?: unknown[];
    video_prompts?: unknown[];
  };
  publishing_package: {
    title_candidates?: string[];
    description?: string;
    tags?: string[];
    thumbnail_prompt?: string;
  };
  publishing_handoff?: {
    path: string;
    ready: boolean;
    blockers: number;
    upload_job_path?: string;
    upload_job_status?: "queued" | "running" | "completed" | "failed" | string;
    upload_job_id?: string;
    upload_channel_name?: string;
    upload_privacy_status?: string;
    upload_scheduled_at?: string;
    uploaded_at?: string;
    uploaded_video_id?: string;
    uploaded_video_url?: string;
    updated_at: string;
  };
  feedback_loop?: {
    analytics_average_view_percentage?: number;
    analytics_ctr?: number;
    analytics_top_traffic_source?: string;
    comment_count: number;
    fetched_at: string;
    like_count: number;
    path: string;
    source: string;
    snapshot_count?: number;
    video_id: string;
    view_count: number;
  };
  feedback_insights?: {
    path: string;
    recommendations: number;
    status: "needs_more_data" | "watch" | "learning" | "strong_signal" | string;
    updated_at: string;
  };
  learning_log?: {
    path: string;
    status: "draft" | "needs_metrics" | "ready_for_comparison" | string;
    updated_at: string;
    variants: number;
  };
  channel_memory_update?: {
    items: number;
    path: string;
    status: "draft" | "ready" | string;
    updated_at: string;
  };
  asset_manifest?: {
    path: string;
    items: number;
    pending_approval: number;
    ready_for_generation?: number;
    blocked?: number;
    updated_at: string;
  };
  render_manifest?: {
    path: string;
    edl_path?: string;
    timeline_items: number;
    ready_timeline_items: number;
    blockers: number;
    render_ready: boolean;
    rendered_path?: string;
    rendered_at?: string;
    editing_handoff_path?: string;
    editing_provider?: string;
    editing_provider_status?: string;
    worker_job_path?: string;
    worker_job_status?: "queued" | "running" | "completed" | "failed" | string;
    worker_job_id?: string;
    updated_at: string;
  };
  qa: {
    status: "pass" | "blocked" | "needs_review";
    blockers: string[];
    warnings?: string[];
    fix_list?: string[];
    approval_checklist?: string[];
    publish_readiness?: "ready" | "not ready" | "render-only ready";
    approval_required?: boolean;
  };
};

export type RunSummary = {
  id: string;
  path: string;
  package: ProductionPackage;
  updatedAt: string;
};

export async function getRuns(): Promise<RunSummary[]> {
  return listRunSummaries();
}

export function getStageState(pkg: ProductionPackage) {
  return [
    {
      name: "접수",
      meta: pkg.brief.topic,
      status: "done" as const,
    },
    {
      name: "리서치",
      meta: `소스 영상 ${pkg.sources.length}개`,
      status: pkg.sources.length > 0 ? ("review" as const) : ("pending" as const),
    },
    {
      name: "영상 분석",
      meta: "경쟁 영상 구조와 훅 분석",
      status: "pending" as const,
    },
    {
      name: "팩트체크",
      meta: `클레임 ${pkg.claim_ledger.length}개`,
      status: pkg.claim_ledger.length > 0 ? ("review" as const) : ("blocked" as const),
    },
    {
      name: "대본",
      meta: pkg.script_plan.hook,
      status: pkg.script_plan.outline.length > 0 ? ("review" as const) : ("pending" as const),
    },
    {
      name: "스토리보드",
      meta: `씬 ${pkg.storyboard.length}개`,
      status: pkg.storyboard.length > 0 ? ("review" as const) : ("pending" as const),
    },
    {
      name: "미디어 요청서",
      meta: `이미지 ${pkg.media_prompts.image_prompts?.length ?? 0}개, 영상 ${
        pkg.media_prompts.video_prompts?.length ?? 0
      }개`,
      status:
        (pkg.media_prompts.image_prompts?.length ?? 0) +
          (pkg.media_prompts.video_prompts?.length ?? 0) >
        0
          ? ("review" as const)
          : ("pending" as const),
    },
    {
      name: "업로드 글",
      meta: `제목 후보 ${pkg.publishing_package.title_candidates?.length ?? 0}개`,
      status:
        (pkg.publishing_package.title_candidates?.length ?? 0) > 0
          ? ("review" as const)
          : ("pending" as const),
    },
    {
      name: "최종 확인",
      meta: `확인 항목 ${pkg.qa.blockers.length}개`,
      status:
        pkg.qa.status === "pass"
          ? ("done" as const)
          : pkg.qa.status === "blocked"
            ? ("blocked" as const)
            : ("review" as const),
    },
  ];
}
