import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clapperboard,
  FileSearch,
  FileText,
  Image,
  KeyRound,
  ListChecks,
  Megaphone,
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
import { AnalysisDraftButton } from "@/app/components/analysis-draft-button";
import { AnalysisRefineButton } from "@/app/components/analysis-refine-button";
import { AssetGenerationConsole } from "@/app/components/asset-generation-console";
import { AssetManifestButton } from "@/app/components/asset-manifest-button";
import { ArtifactWorkspace } from "@/app/components/artifact-workspace";
import { EnrichSourcesButton } from "@/app/components/enrich-sources-button";
import { GenerationQueueButton } from "@/app/components/generation-queue-button";
import { MediaPromptDraftButton } from "@/app/components/media-prompt-draft-button";
import { LocalRenderButton } from "@/app/components/local-render-button";
import { NewRunForm } from "@/app/components/new-run-form";
import { PackageValidationPanel } from "@/app/components/package-validation-panel";
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
import { validateProductionPackage, type PackageValidationResult } from "@/lib/package-validation";
import { getSafeProviderSettings } from "@/lib/provider-settings";
import { providerRoles, type SafeProviderSettings } from "@/lib/provider-settings-shared";
import { getRuns, getStageState, type RunSummary } from "@/lib/runs";
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

function Sidebar({ runs, activeRun }: { runs: RunSummary[]; activeRun?: RunSummary }) {
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

function Inspector({
  run,
  validation,
  providerSettings,
  approvals,
  generationState,
  storageMode,
  workerStatus,
}: {
  run: RunSummary;
  validation: PackageValidationResult;
  providerSettings: SafeProviderSettings;
  approvals: RunApprovals;
  generationState: AssetGenerationState;
  storageMode: string;
  workerStatus: RunWorkerStatus;
}) {
  const brief = run.package.brief;
  const readyProviderCount = providerRoles.filter((role) => {
    const setting = providerSettings.roles[role.id];
    return setting.enabled && setting.hasApiKey;
  }).length;
  return (
    <aside className="inspector">
      <div className="detail-stack">
        <section className="panel">
          <div className="panel-header">
            <h3 className="panel-title">새 실행</h3>
            <Rocket size={16} />
          </div>
          <div className="panel-body">
            <NewRunForm />
          </div>
        </section>

        <PackageValidationPanel initialResult={validation} runId={run.id} />

        <RunApprovalsPanel key={run.id} initialApprovals={approvals} runId={run.id} />

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

        <section className="panel">
          <div className="panel-header">
            <h3 className="panel-title">검수 차단 항목</h3>
            <AlertTriangle size={16} />
          </div>
          <div className="panel-body">
            <ul className="blocker-list">
              {run.package.qa.blockers.map((blocker) => (
                <li key={blocker}>
                  <AlertTriangle size={15} color="#b7791f" />
                  <span>{blocker}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

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
                <span>
                  {run.package.asset_manifest
                    ? `${run.package.asset_manifest.items}개`
                    : "대기"}
                </span>
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
  const providerSettings = await getSafeProviderSettings();
  const params = searchParams ? await searchParams : {};
  const activeRun = runs.find((run) => run.id === params.run) ?? runs[0];
  const artifacts = activeRun ? await getRunArtifacts(activeRun.id) : [];
  const generationState = activeRun ? await getAssetGenerationState(activeRun.id) : null;
  const validation = activeRun ? validateProductionPackage(activeRun.package) : null;
  const approvals = activeRun ? await getRunApprovals(activeRun.id) : null;
  const workerStatus = activeRun ? await getRunWorkerStatus(activeRun.id, activeRun.package) : null;
  const storageMode = process.env.APP_STORAGE_MODE?.trim() || "local";

  return (
    <div className="shell">
      <Sidebar runs={runs} activeRun={activeRun} />
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
              <button className="icon-button" title="미디어 대기열 열기" type="button">
                <Megaphone size={16} />
              </button>
              <Link className="icon-button" href="/settings" title="제공자 설정">
                <Settings size={16} />
              </Link>
              <RunDraftFlowButton runId={activeRun.id} />
              <AnalysisDraftButton runId={activeRun.id} />
              <AnalysisRefineButton runId={activeRun.id} />
              <ScriptDraftButton runId={activeRun.id} />
              <ScriptRefineButton runId={activeRun.id} />
              <StoryboardDraftButton runId={activeRun.id} />
              <MediaPromptDraftButton runId={activeRun.id} />
              <AssetManifestButton runId={activeRun.id} />
              <GenerationQueueButton runId={activeRun.id} />
              <SubtitleDraftButton runId={activeRun.id} />
              <RenderManifestButton runId={activeRun.id} />
              <RenderWorkerJobButton runId={activeRun.id} />
              <LocalRenderButton runId={activeRun.id} />
              <PublishingDraftButton runId={activeRun.id} />
              <PublishingHandoffButton runId={activeRun.id} />
              <YouTubeUploadJobButton runId={activeRun.id} />
              <QaDraftButton runId={activeRun.id} />
            </div>
          </div>

          <SummaryGrid run={activeRun} />

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
