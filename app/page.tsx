import {
  AlertTriangle,
  BarChart3,
  Brain,
  CheckCircle2,
  Clapperboard,
  FileSearch,
  FileText,
  Image,
  KeyRound,
  ListChecks,
  Mic2,
  PlayCircle,
  RefreshCw,
  Rocket,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Upload,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { AbLearningLogButton } from "@/app/components/ab-learning-log-button";
import { AnalysisDraftButton } from "@/app/components/analysis-draft-button";
import { AnalysisRefineButton } from "@/app/components/analysis-refine-button";
import { AssetGenerationConsole } from "@/app/components/asset-generation-console";
import { AssetManifestButton } from "@/app/components/asset-manifest-button";
import { ArtifactWorkspace } from "@/app/components/artifact-workspace";
import { ChannelMemoryButton } from "@/app/components/channel-memory-button";
import { EnrichSourcesButton } from "@/app/components/enrich-sources-button";
import { FeedbackLoopFlowButton } from "@/app/components/feedback-loop-flow-button";
import { FeedbackInsightsButton } from "@/app/components/feedback-insights-button";
import { GenerationQueueButton } from "@/app/components/generation-queue-button";
import { MediaPromptDraftButton } from "@/app/components/media-prompt-draft-button";
import { LocalRenderButton } from "@/app/components/local-render-button";
import { NewRunForm } from "@/app/components/new-run-form";
import { PackageValidationPanel } from "@/app/components/package-validation-panel";
import { PerformanceSnapshotButton } from "@/app/components/performance-snapshot-button";
import { PublishingDraftButton } from "@/app/components/publishing-draft-button";
import { PublishingHandoffButton } from "@/app/components/publishing-handoff-button";
import { QaDraftButton } from "@/app/components/qa-draft-button";
import { RenderManifestButton } from "@/app/components/render-manifest-button";
import { RenderWorkerJobButton } from "@/app/components/render-worker-job-button";
import { RunDeleteButton } from "@/app/components/run-delete-button";
import { RunDraftFlowButton } from "@/app/components/run-draft-flow-button";
import { RunApprovalsPanel } from "@/app/components/run-approvals-panel";
import { ScriptDraftButton } from "@/app/components/script-draft-button";
import { ScriptRefineButton } from "@/app/components/script-refine-button";
import { SourceTranscriptPanel } from "@/app/components/source-transcript-panel";
import { StoryboardDraftButton } from "@/app/components/storyboard-draft-button";
import { SubtitleDraftButton } from "@/app/components/subtitle-draft-button";
import { YouTubeFinderPanel } from "@/app/components/youtube-finder-panel";
import { YouTubeUploadJobButton } from "@/app/components/youtube-upload-job-button";
import { YouTubeUploadWorkerPanel } from "@/app/components/youtube-upload-worker-panel";
import { WorkerStatusPanel } from "@/app/components/worker-status-panel";
import { getRunApprovals, type RunApprovals } from "@/lib/approvals";
import { getAssetGenerationState, type AssetGenerationState } from "@/lib/asset-generation-state";
import { getRunArtifacts } from "@/lib/artifacts";
import { getChannelMemoryIndex, type ChannelMemoryIndex } from "@/lib/channel-memory-index";
import { validateProductionPackage, type PackageValidationResult } from "@/lib/package-validation";
import { getSafeProviderSettings } from "@/lib/provider-settings";
import { providerRoles, type SafeProviderSettings } from "@/lib/provider-settings-shared";
import {
  getRunNextActionPlan,
  type RunNextActionPlan,
  type RunPrimaryActionId,
} from "@/lib/run-next-actions";
import { getRuns, getStageState, type RunSummary } from "@/lib/runs";
import { getWorkQueueSummary, workQueueStatusCopy, type WorkQueueSummary } from "@/lib/work-queue";
import { getRunWorkerStatus, type RunWorkerStatus } from "@/lib/worker-status";

export const dynamic = "force-dynamic";

const navItems = [
  { label: "파이프라인", icon: ListChecks, active: true },
  { label: "소스", icon: FileSearch, active: false },
  { label: "대본", icon: FileText, active: false },
  { label: "스토리보드", icon: Clapperboard, active: false },
  { label: "미디어", icon: Image, active: false },
  { label: "배포", icon: Upload, active: false },
  { label: "검수", icon: ShieldCheck, active: false },
];

const skillItems = [
  "youtube-market-research",
  "youtube-video-analysis",
  "youtube-fact-check",
  "youtube-script-architect",
  "youtube-storyboard",
  "youtube-media-prompts",
  "youtube-production-qa",
];

const skillLabels: Record<string, string> = {
  "youtube-market-research": "시장 리서치",
  "youtube-video-analysis": "영상 분석",
  "youtube-fact-check": "팩트체크",
  "youtube-script-architect": "대본 설계",
  "youtube-storyboard": "스토리보드",
  "youtube-media-prompts": "미디어 프롬프트",
  "youtube-production-qa": "제작 검수",
};

const statusCopy = {
  done: "완료",
  review: "검토",
  blocked: "차단",
  pending: "대기",
};

const qaStatusCopy: Record<string, string> = {
  pass: "검수 통과",
  blocked: "검수 차단",
  needs_review: "검토 필요",
};

const transcriptStatusCopy: Record<string, string> = {
  not_checked: "미확인",
  missing: "없음",
  manual_transcript: "수동 입력",
  available: "확보됨",
};

const feedbackStatusCopy: Record<string, string> = {
  learning: "학습 중",
  needs_more_data: "데이터 필요",
  strong_signal: "강한 신호",
  watch: "주의 관찰",
};

const learningStatusCopy: Record<string, string> = {
  draft: "초안",
  needs_metrics: "지표 필요",
  ready_for_comparison: "비교 준비",
};

const memoryStatusCopy: Record<string, string> = {
  draft: "초안",
  ready: "준비됨",
};

const formatCopy: Record<string, string> = {
  shorts: "쇼츠",
  longform: "롱폼",
  explainer: "설명형",
  documentary: "다큐형",
};

const languageCopy: Record<string, string> = {
  ko: "한국어",
  en: "영어",
};

const statusIcons = {
  done: CheckCircle2,
  review: AlertTriangle,
  blocked: AlertTriangle,
  pending: PlayCircle,
};

function StatusPill({ status }: { status: "done" | "review" | "blocked" | "pending" }) {
  const Icon = statusIcons[status];
  return (
    <span className={`status-pill ${status}`} title={statusCopy[status]}>
      <Icon size={14} />
      {statusCopy[status]}
    </span>
  );
}

function ChannelMemoryIndexPanel({ index }: { index: ChannelMemoryIndex }) {
  const topExperiment = index.next_experiments[0]?.text ?? "아직 누적 실험 메모리가 없습니다";
  return (
    <section className="nav-section channel-memory-index">
      <h2>채널 메모리</h2>
      <div className="memory-index-card">
        <div className="memory-index-heading">
          <Brain size={16} />
          <strong>
            {index.ready_update_count}/{index.run_count} 준비
          </strong>
        </div>
        <p>{topExperiment}</p>
        <div className="memory-index-stats">
          <span>업데이트 {index.update_count}</span>
          <span>대기 {index.skipped_runs}</span>
        </div>
      </div>
    </section>
  );
}

function WorkQueuePanel({ summary }: { summary: WorkQueueSummary }) {
  const nextItem = summary.nextItem;
  return (
    <section className="nav-section work-queue-index">
      <h2>작업 큐</h2>
      <div className="work-queue-card">
        <div className="work-queue-heading">
          <ListChecks size={16} />
          <strong>{summary.codexReady}개 진행 가능</strong>
          <span>{summary.externalBlocked}개 외부 대기</span>
        </div>
        <p>{nextItem ? nextItem.title : "현재 Codex가 바로 진행할 작업이 없습니다"}</p>
        <div className="work-queue-stats">
          <span>
            {workQueueStatusCopy.next} {summary.next}
          </span>
          <span>
            {workQueueStatusCopy.deferred} {summary.deferred}
          </span>
          <span>
            {workQueueStatusCopy.done} {summary.done}
          </span>
        </div>
      </div>
    </section>
  );
}

function Sidebar({
  activeRun,
  memoryIndex,
  runs,
  workQueueSummary,
}: {
  activeRun?: RunSummary;
  memoryIndex: ChannelMemoryIndex;
  runs: RunSummary[];
  workQueueSummary: WorkQueueSummary;
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <Wand2 size={19} />
        </div>
        <div>
          <h1>YouTube Idea Factory</h1>
          <p>제작 운영</p>
        </div>
      </div>

      <section className="nav-section">
        <h2>작업공간</h2>
        <ul className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.label} className={`nav-item ${item.active ? "active" : ""}`}>
                <Icon size={16} />
                {item.label}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="nav-section">
        <h2>실행 기록</h2>
        <div className="nav-list">
          {runs.slice(0, 5).map((run) => (
            <Link
              className={`run-card ${run.id === activeRun?.id ? "active" : ""}`}
              href={`/?run=${encodeURIComponent(run.id)}`}
              key={run.id}
            >
              <strong>{run.package.brief.topic}</strong>
              <span>{run.id}</span>
            </Link>
          ))}
          {runs.length === 0 ? <p className="muted">실행 기록이 없습니다</p> : null}
        </div>
      </section>

      <ChannelMemoryIndexPanel index={memoryIndex} />

      <WorkQueuePanel summary={workQueueSummary} />

      <section className="nav-section">
        <h2>스킬</h2>
        <ul className="nav-list">
          {skillItems.map((skill) => (
            <li key={skill} className="nav-item">
              <Sparkles size={15} />
              {skillLabels[skill] ?? skill}
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}

function EmptyState() {
  return (
    <main className="main">
      <div className="topbar">
        <div>
          <p className="eyebrow">1단계</p>
          <h2>제작 작업공간</h2>
        </div>
      </div>
      <div className="empty-state">
        <div>
          <Rocket size={34} />
          <h3>아직 제작 실행이 없습니다</h3>
          <p>새 실행을 만들면 제작 패키지가 파이프라인을 따라 여기에 표시됩니다.</p>
        </div>
      </div>
    </main>
  );
}

function SummaryGrid({ run }: { run: RunSummary }) {
  const pkg = run.package;
  const promptCount =
    (pkg.media_prompts.image_prompts?.length ?? 0) +
    (pkg.media_prompts.video_prompts?.length ?? 0);
  return (
    <section className="summary-grid" aria-label="실행 요약">
      <div className="stat">
        <p className="stat-label">소스</p>
        <p className="stat-value">
          <Search size={19} />
          {pkg.sources.length}
        </p>
      </div>
      <div className="stat">
        <p className="stat-label">클레임</p>
        <p className="stat-value">
          <ShieldCheck size={19} />
          {pkg.claim_ledger.length}
        </p>
      </div>
      <div className="stat">
        <p className="stat-label">씬</p>
        <p className="stat-value">
          <Clapperboard size={19} />
          {pkg.storyboard.length}
        </p>
      </div>
      <div className="stat">
        <p className="stat-label">프롬프트</p>
        <p className="stat-value">
          <Image size={19} />
          {promptCount}
        </p>
      </div>
    </section>
  );
}

function WorkflowActionButton({
  actionId,
  run,
}: {
  actionId: RunPrimaryActionId;
  run: RunSummary;
}) {
  const runId = run.id;
  switch (actionId) {
    case "source-enrich":
      return <EnrichSourcesButton runId={runId} />;
    case "draft-flow":
      return <RunDraftFlowButton runId={runId} />;
    case "analysis-draft":
      return <AnalysisDraftButton runId={runId} />;
    case "analysis-refine":
      return <AnalysisRefineButton runId={runId} />;
    case "script-draft":
      return <ScriptDraftButton runId={runId} />;
    case "script-refine":
      return <ScriptRefineButton runId={runId} />;
    case "storyboard-draft":
      return <StoryboardDraftButton runId={runId} />;
    case "media-draft":
      return <MediaPromptDraftButton runId={runId} />;
    case "asset-manifest":
      return <AssetManifestButton runId={runId} />;
    case "generation-queue":
      return <GenerationQueueButton runId={runId} />;
    case "subtitle-draft":
      return <SubtitleDraftButton runId={runId} />;
    case "render-manifest":
      return <RenderManifestButton runId={runId} />;
    case "render-job":
      return <RenderWorkerJobButton runId={runId} />;
    case "local-render":
      return <LocalRenderButton runId={runId} />;
    case "publishing-draft":
      return <PublishingDraftButton runId={runId} />;
    case "publishing-handoff":
      return <PublishingHandoffButton runId={runId} />;
    case "youtube-upload-job":
      return <YouTubeUploadJobButton runId={runId} />;
    case "performance-snapshot":
      return (
        <PerformanceSnapshotButton
          runId={runId}
          videoId={run.package.publishing_handoff?.uploaded_video_id ?? run.package.feedback_loop?.video_id}
        />
      );
    case "feedback-flow":
      return (
        <FeedbackLoopFlowButton
          runId={runId}
          videoId={run.package.publishing_handoff?.uploaded_video_id ?? run.package.feedback_loop?.video_id}
        />
      );
    case "feedback-insights":
      return <FeedbackInsightsButton runId={runId} />;
    case "learning-log":
      return <AbLearningLogButton runId={runId} />;
    case "channel-memory":
      return <ChannelMemoryButton runId={runId} />;
    case "qa-draft":
      return <QaDraftButton runId={runId} />;
    case "open-settings":
      return (
        <Link className="text-button primary" href="/settings">
          <Settings size={15} />
          제공자 설정
        </Link>
      );
  }
}

function AdvancedActionMenu({ run }: { run: RunSummary }) {
  return (
    <details className="advanced-action-menu">
      <summary className="text-button">고급 도구</summary>
      <div className="advanced-action-grid">
        <div>
          <strong>초안</strong>
          <RunDraftFlowButton runId={run.id} />
          <AnalysisDraftButton runId={run.id} />
          <ScriptDraftButton runId={run.id} />
          <StoryboardDraftButton runId={run.id} />
          <MediaPromptDraftButton runId={run.id} />
          <PublishingDraftButton runId={run.id} />
          <QaDraftButton runId={run.id} />
        </div>
        <div>
          <strong>고도화</strong>
          <AnalysisRefineButton runId={run.id} />
          <ScriptRefineButton runId={run.id} />
          <EnrichSourcesButton runId={run.id} />
          <AssetManifestButton runId={run.id} />
          <GenerationQueueButton runId={run.id} />
          <SubtitleDraftButton runId={run.id} />
        </div>
        <div>
          <strong>렌더/배포</strong>
          <RenderManifestButton runId={run.id} />
          <RenderWorkerJobButton runId={run.id} />
          <LocalRenderButton runId={run.id} />
          <PublishingHandoffButton runId={run.id} />
          <YouTubeUploadJobButton runId={run.id} />
        </div>
        <div>
          <strong>피드백</strong>
          <PerformanceSnapshotButton
            runId={run.id}
            videoId={run.package.publishing_handoff?.uploaded_video_id ?? run.package.feedback_loop?.video_id}
          />
          <FeedbackLoopFlowButton
            runId={run.id}
            videoId={run.package.publishing_handoff?.uploaded_video_id ?? run.package.feedback_loop?.video_id}
          />
          <FeedbackInsightsButton runId={run.id} />
          <AbLearningLogButton runId={run.id} />
          <ChannelMemoryButton runId={run.id} />
        </div>
      </div>
    </details>
  );
}

function RunNextActionPanel({ plan, run }: { plan: RunNextActionPlan; run: RunSummary }) {
  const secondaryActions = plan.secondaryActionIds ?? [];
  return (
    <section className="panel next-action-panel">
      <div className="next-action-main">
        <div>
          <p className="eyebrow">
            {plan.stageIndex}/{plan.totalStages} {plan.stageLabel}
          </p>
          <h3>{plan.headline}</h3>
          <p>{plan.detail}</p>
        </div>
        <StatusPill status={plan.status} />
      </div>
      <div className="next-action-cta">
        {plan.primaryActionId ? (
          <div className="guide-action-primary">
            <WorkflowActionButton actionId={plan.primaryActionId} run={run} />
          </div>
        ) : (
          <p className="next-action-note">오른쪽 패널에서 승인 또는 수동 확인을 완료하세요.</p>
        )}
        {secondaryActions.length > 0 ? (
          <div className="guide-action-secondary">
            {secondaryActions.map((actionId) => (
              <WorkflowActionButton actionId={actionId} key={actionId} run={run} />
            ))}
          </div>
        ) : null}
      </div>
      <div className="next-action-list">
        {plan.items.map((item) => (
          <div className="next-action-item" key={`${item.title}-${item.detail}`}>
            <div>
              <strong>{item.title}</strong>
              <span>{item.detail}</span>
              {item.command ? <code>{item.command}</code> : null}
            </div>
            <StatusPill status={item.status} />
          </div>
        ))}
      </div>
    </section>
  );
}

function PipelinePanel({ run }: { run: RunSummary }) {
  const stages = getStageState(run.package);
  return (
    <section className="panel">
      <div className="panel-header">
        <h3 className="panel-title">파이프라인</h3>
        <span className="meta">{qaStatusCopy[run.package.qa.status] ?? run.package.qa.status}</span>
      </div>
      <div className="panel-body">
        <div className="stage-list">
          {stages.map((stage, index) => (
            <div className="stage-row" key={stage.name}>
              <div className="stage-index">{String(index + 1).padStart(2, "0")}</div>
              <div>
                <p className="stage-name">{stage.name}</p>
                <p className="stage-meta">{stage.meta}</p>
              </div>
              <StatusPill status={stage.status} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SourcesPanel({ run }: { run: RunSummary }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h3 className="panel-title">소스 영상</h3>
        <EnrichSourcesButton runId={run.id} />
      </div>
      <div className="panel-body">
        <table className="source-table">
          <thead>
            <tr>
              <th>순위</th>
              <th>소스</th>
              <th>자막/스크립트</th>
            </tr>
          </thead>
          <tbody>
            {run.package.sources.map((source, index) => (
              <tr key={`${source.url}-${index}`}>
                <td>{source.rank ?? index + 1}</td>
                <td>
                  <div className="source-title">{source.title}</div>
                  <a className="source-url" href={source.url}>
                    {source.url}
                  </a>
                </td>
                <td>
                  {transcriptStatusCopy[source.transcript_status ?? "not_checked"] ??
                    source.transcript_status ??
                    "미확인"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <SourceTranscriptPanel runId={run.id} sources={run.package.sources} />
      </div>
    </section>
  );
}

function narrationFromStoryboard(storyboard: unknown[]) {
  return storyboard
    .filter((item): item is { narration?: unknown } => typeof item === "object" && item !== null)
    .map((item) => (typeof item.narration === "string" ? item.narration.trim() : ""))
    .filter(Boolean)
    .join("\n\n");
}

function NewRunPanel() {
  return (
    <section className="panel">
      <div className="panel-header">
        <h3 className="panel-title">새 실행</h3>
        <Rocket size={16} />
      </div>
      <div className="panel-body">
        <NewRunForm />
      </div>
    </section>
  );
}

function ProviderReadinessPanel({
  providerSettings,
}: {
  providerSettings: SafeProviderSettings;
}) {
  const readyProviderCount = providerRoles.filter((role) => {
    const setting = providerSettings.roles[role.id];
    return setting.enabled && setting.hasApiKey;
  }).length;
  return (
    <section className="panel">
      <div className="panel-header">
        <h3 className="panel-title">제공자 준비 상태</h3>
        <KeyRound size={16} />
      </div>
      <div className="panel-body">
        <div className="detail-stack">
          <div className="detail-row">
            <span>준비됨</span>
            <span>
              {readyProviderCount}/{providerRoles.length}
            </span>
          </div>
          {providerRoles.map((role) => {
            const setting = providerSettings.roles[role.id];
            const status =
              setting.enabled && setting.hasApiKey
                ? "준비됨"
                : setting.enabled
                  ? "키 필요"
                  : "꺼짐";
            return (
              <div className="detail-row" key={role.id}>
                <span>{role.label}</span>
                <span>{status}</span>
              </div>
            );
          })}
          <Link className="text-button form-submit" href="/settings">
            <Settings size={15} />
            제공자 설정
          </Link>
        </div>
      </div>
    </section>
  );
}

function BriefPanel({ run }: { run: RunSummary }) {
  const brief = run.package.brief;
  return (
    <section className="panel">
      <div className="panel-header">
        <h3 className="panel-title">실행 브리프</h3>
        <BarChart3 size={16} />
      </div>
      <div className="panel-body">
        <div className="detail-stack">
          <div className="detail-row">
            <span>실행</span>
            <span>{run.id}</span>
          </div>
          <div className="detail-row">
            <span>주제</span>
            <span>{brief.topic}</span>
          </div>
          <div className="detail-row">
            <span>카테고리</span>
            <span>{brief.category || "미지정"}</span>
          </div>
          <div className="detail-row">
            <span>형식</span>
            <span>{formatCopy[brief.format] ?? brief.format}</span>
          </div>
          <div className="detail-row">
            <span>언어</span>
            <span>{languageCopy[brief.language] ?? brief.language}</span>
          </div>
          <div className="detail-row">
            <span>길이</span>
            <span>{brief.target_duration_seconds ?? 0}s</span>
          </div>
          <RunDeleteButton runId={run.id} topic={brief.topic} />
        </div>
      </div>
    </section>
  );
}

function BlockersPanel({ blockers }: { blockers: string[] }) {
  if (blockers.length === 0) {
    return null;
  }
  return (
    <section className="panel">
      <div className="panel-header">
        <h3 className="panel-title">검수 차단 항목</h3>
        <AlertTriangle size={16} />
      </div>
      <div className="panel-body">
        <ul className="blocker-list">
          {blockers.map((blocker) => (
            <li key={blocker}>
              <AlertTriangle size={15} color="#b7791f" />
              <span>{blocker}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function GenerationConsolePanel({
  generationState,
  run,
}: {
  generationState: AssetGenerationState;
  run: RunSummary;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h3 className="panel-title">생성 콘솔</h3>
        <Sparkles size={16} />
      </div>
      <div className="panel-body">
        <AssetGenerationConsole
          defaultNarration={narrationFromStoryboard(run.package.storyboard)}
          runId={run.id}
          state={generationState}
        />
      </div>
    </section>
  );
}

function AssemblyPanel({
  run,
  storageMode,
  workerStatus,
}: {
  run: RunSummary;
  storageMode: string;
  workerStatus: RunWorkerStatus;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h3 className="panel-title">영상 조립</h3>
        <Mic2 size={16} />
      </div>
      <div className="panel-body">
        <div className="detail-stack">
          <div className="detail-row">
            <span>음성</span>
            <span>대기</span>
          </div>
          <div className="detail-row">
            <span>자막</span>
            <span>대기</span>
          </div>
          <div className="detail-row">
            <span>BGM</span>
            <span>대기</span>
          </div>
          <div className="detail-row">
            <span>렌더</span>
            <span>{run.package.render_manifest?.render_ready ? "준비됨" : "대기"}</span>
          </div>
          <div className="detail-row">
            <span>최종 파일</span>
            <span>{run.package.render_manifest?.rendered_path ?? "대기"}</span>
          </div>
          <div className="detail-row">
            <span>렌더 작업</span>
            <span>{run.package.render_manifest?.worker_job_status ?? "대기"}</span>
          </div>
          <div className="detail-row">
            <span>자산 매니페스트</span>
            <span>{run.package.asset_manifest ? `${run.package.asset_manifest.items}개` : "대기"}</span>
          </div>
          <div className="detail-row">
            <span>생성 대기열</span>
            <span>{run.package.asset_manifest?.ready_for_generation ?? 0}</span>
          </div>
          <div className="detail-row">
            <span>대기열 차단</span>
            <span>{run.package.asset_manifest?.blocked ?? 0}</span>
          </div>
          <div className="detail-row">
            <span>렌더 차단</span>
            <span>{run.package.render_manifest?.blockers ?? 0}</span>
          </div>
          <div className="detail-row">
            <span>배포 핸드오프</span>
            <span>{run.package.publishing_handoff?.ready ? "준비됨" : "대기"}</span>
          </div>
          <div className="detail-row">
            <span>업로드 작업</span>
            <span>{run.package.publishing_handoff?.upload_job_status ?? "대기"}</span>
          </div>
          <WorkerStatusPanel runId={run.id} status={workerStatus} />
          <YouTubeUploadWorkerPanel
            runId={run.id}
            storageMode={storageMode}
            uploadJobStatus={run.package.publishing_handoff?.upload_job_status}
          />
        </div>
      </div>
    </section>
  );
}

function FeedbackPanel({ run }: { run: RunSummary }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h3 className="panel-title">피드백 루프</h3>
        <BarChart3 size={16} />
      </div>
      <div className="panel-body">
        <div className="detail-stack">
          <div className="detail-row">
            <span>영상 ID</span>
            <span>{run.package.feedback_loop?.video_id ?? "대기"}</span>
          </div>
          <div className="detail-row">
            <span>조회수</span>
            <span>{run.package.feedback_loop?.view_count ?? 0}</span>
          </div>
          <div className="detail-row">
            <span>좋아요</span>
            <span>{run.package.feedback_loop?.like_count ?? 0}</span>
          </div>
          <div className="detail-row">
            <span>댓글</span>
            <span>{run.package.feedback_loop?.comment_count ?? 0}</span>
          </div>
          <div className="detail-row">
            <span>수집 시각</span>
            <span>{run.package.feedback_loop?.fetched_at ?? "대기"}</span>
          </div>
          <div className="detail-row">
            <span>누적 스냅샷</span>
            <span>{run.package.feedback_loop?.snapshot_count ?? 0}</span>
          </div>
          <PerformanceSnapshotButton
            runId={run.id}
            videoId={run.package.publishing_handoff?.uploaded_video_id ?? run.package.feedback_loop?.video_id}
          />
          <FeedbackLoopFlowButton
            runId={run.id}
            videoId={run.package.publishing_handoff?.uploaded_video_id ?? run.package.feedback_loop?.video_id}
          />
          <FeedbackInsightsButton runId={run.id} />
          <AbLearningLogButton runId={run.id} />
          <ChannelMemoryButton runId={run.id} />
          <div className="detail-row">
            <span>인사이트</span>
            <span>
              {run.package.feedback_insights?.status
                ? feedbackStatusCopy[run.package.feedback_insights.status] ??
                  run.package.feedback_insights.status
                : "대기"}
            </span>
          </div>
          <div className="detail-row">
            <span>추천 항목</span>
            <span>{run.package.feedback_insights?.recommendations ?? 0}</span>
          </div>
          <div className="detail-row">
            <span>A/B 로그</span>
            <span>
              {run.package.learning_log?.status
                ? learningStatusCopy[run.package.learning_log.status] ?? run.package.learning_log.status
                : "대기"}
            </span>
          </div>
          <div className="detail-row">
            <span>변형 카드</span>
            <span>{run.package.learning_log?.variants ?? 0}</span>
          </div>
          <div className="detail-row">
            <span>채널 메모리</span>
            <span>
              {run.package.channel_memory_update?.status
                ? memoryStatusCopy[run.package.channel_memory_update.status] ??
                  run.package.channel_memory_update.status
                : "대기"}
            </span>
          </div>
          <div className="detail-row">
            <span>메모리 항목</span>
            <span>{run.package.channel_memory_update?.items ?? 0}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function StageFocusPanel({ plan, run }: { plan: RunNextActionPlan; run: RunSummary }) {
  const sourceCount = run.package.sources.length;
  const missingTranscripts = run.package.sources.filter(
    (source) => source.transcript_status !== "manual_transcript" && source.transcript_status !== "available",
  ).length;
  return (
    <section className="panel focus-inspector-panel">
      <div className="panel-header">
        <div>
          <h3 className="panel-title">현재 단계</h3>
          <p className="panel-subtitle">
            {plan.stageIndex}/{plan.totalStages} {plan.stageLabel}
          </p>
        </div>
        <StatusPill status={plan.status} />
      </div>
      <div className="panel-body">
        <div className="stage-focus-summary">
          <strong>{plan.headline}</strong>
          <span>{plan.detail}</span>
        </div>
        <div className="stage-focus-checks">
          <div>
            <span>소스</span>
            <strong>{sourceCount}</strong>
          </div>
          <div>
            <span>미확인 스크립트</span>
            <strong>{missingTranscripts}</strong>
          </div>
          <div>
            <span>클레임</span>
            <strong>{run.package.claim_ledger.length}</strong>
          </div>
          <div>
            <span>씬</span>
            <strong>{run.package.storyboard.length}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}

function Inspector({
  run,
  validation,
  providerSettings,
  approvals,
  generationState,
  nextActionPlan,
  storageMode,
  workerStatus,
}: {
  run: RunSummary;
  validation: PackageValidationResult;
  providerSettings: SafeProviderSettings;
  approvals: RunApprovals;
  generationState: AssetGenerationState;
  nextActionPlan: RunNextActionPlan;
  storageMode: string;
  workerStatus: RunWorkerStatus;
}) {
  const stage = nextActionPlan.stageLabel;
  const showApprovals = nextActionPlan.headline.includes("승인");
  const showGeneration =
    stage === "생성 승인" || stage === "자산 구성" || stage === "자산 생성";
  const showAssembly = stage === "렌더" || stage === "배포";
  const showFeedback = stage === "피드백";
  const showProviderReadiness = showGeneration || nextActionPlan.primaryActionId === "open-settings";

  return (
    <aside className="inspector">
      <div className="detail-stack">
        <StageFocusPanel plan={nextActionPlan} run={run} />

        <PackageValidationPanel initialResult={validation} runId={run.id} />

        <BlockersPanel blockers={run.package.qa.blockers} />

        {showApprovals ? (
          <RunApprovalsPanel key={run.id} initialApprovals={approvals} runId={run.id} />
        ) : null}

        {showProviderReadiness ? <ProviderReadinessPanel providerSettings={providerSettings} /> : null}

        {showGeneration ? <GenerationConsolePanel generationState={generationState} run={run} /> : null}

        {showAssembly ? (
          <AssemblyPanel run={run} storageMode={storageMode} workerStatus={workerStatus} />
        ) : null}

        {showFeedback ? <FeedbackPanel run={run} /> : null}

        <details className="inspector-more">
          <summary>기타 운영 패널</summary>
          <div className="detail-stack">
            <NewRunPanel />
            <BriefPanel run={run} />
            {!showApprovals ? (
              <RunApprovalsPanel key={`${run.id}-more`} initialApprovals={approvals} runId={run.id} />
            ) : null}
            {!showProviderReadiness ? <ProviderReadinessPanel providerSettings={providerSettings} /> : null}
            {!showGeneration ? <GenerationConsolePanel generationState={generationState} run={run} /> : null}
            {!showAssembly ? (
              <AssemblyPanel run={run} storageMode={storageMode} workerStatus={workerStatus} />
            ) : null}
            {!showFeedback ? <FeedbackPanel run={run} /> : null}
          </div>
        </details>
      </div>
    </aside>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ run?: string }>;
}) {
  const runs = await getRuns();
  const memoryIndex = await getChannelMemoryIndex(runs);
  const workQueueSummary = getWorkQueueSummary();
  const providerSettings = await getSafeProviderSettings();
  const params = searchParams ? await searchParams : {};
  const activeRun = runs.find((run) => run.id === params.run) ?? runs[0];
  const artifacts = activeRun ? await getRunArtifacts(activeRun.id) : [];
  const generationState = activeRun ? await getAssetGenerationState(activeRun.id) : null;
  const validation = activeRun ? validateProductionPackage(activeRun.package) : null;
  const approvals = activeRun ? await getRunApprovals(activeRun.id) : null;
  const workerStatus = activeRun ? await getRunWorkerStatus(activeRun.id, activeRun.package) : null;
  const storageMode = process.env.APP_STORAGE_MODE?.trim() || "local";
  const nextActionPlan =
    activeRun && validation && approvals && generationState && workerStatus
      ? getRunNextActionPlan({
          approvals,
          generationState,
          pkg: activeRun.package,
          storageMode,
          validation,
          workerStatus,
        })
      : null;

  return (
    <div className="shell">
      <Sidebar
        activeRun={activeRun}
        memoryIndex={memoryIndex}
        runs={runs}
        workQueueSummary={workQueueSummary}
      />
      {activeRun ? (
        <main className="main">
          <div className="topbar">
            <div>
              <p className="eyebrow">1단계 제작 실행</p>
              <h2>{activeRun.package.brief.topic}</h2>
              <p className="muted">
                {formatCopy[activeRun.package.brief.format] ?? activeRun.package.brief.format} /{" "}
                {languageCopy[activeRun.package.brief.language] ?? activeRun.package.brief.language} /{" "}
                {activeRun.package.brief.target_audience || "대상 시청자 미정"}
              </p>
            </div>
            <div className="toolbar">
              <button className="icon-button" title="실행 데이터 새로고침" type="button">
                <RefreshCw size={16} />
              </button>
              <Link className="icon-button" href="/settings" title="제공자 설정">
                <Settings size={16} />
              </Link>
              <AdvancedActionMenu run={activeRun} />
            </div>
          </div>

          <SummaryGrid run={activeRun} />

          {nextActionPlan ? <RunNextActionPanel plan={nextActionPlan} run={activeRun} /> : null}

          <YouTubeFinderPanel defaultQuery={activeRun.package.brief.topic} runId={activeRun.id} />

          <div className="workspace-grid">
            <PipelinePanel run={activeRun} />
            <SourcesPanel run={activeRun} />
          </div>

          <ArtifactWorkspace artifacts={artifacts} runId={activeRun.id} />
        </main>
      ) : (
        <EmptyState />
      )}
      {activeRun ? (
        <Inspector
          approvals={approvals!}
          generationState={generationState!}
          nextActionPlan={nextActionPlan!}
          providerSettings={providerSettings}
          run={activeRun}
          storageMode={storageMode}
          validation={validation!}
          workerStatus={workerStatus!}
        />
      ) : (
        <aside className="inspector">
          <section className="panel">
            <div className="panel-header">
              <h3 className="panel-title">새 실행</h3>
              <Rocket size={16} />
            </div>
            <div className="panel-body">
              <NewRunForm />
            </div>
          </section>
        </aside>
      )}
    </div>
  );
}
