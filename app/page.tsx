import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clapperboard,
  FileSearch,
  FileText,
  Image,
  ListChecks,
  Megaphone,
  Mic2,
  PlayCircle,
  RefreshCw,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { AnalysisDraftButton } from "@/app/components/analysis-draft-button";
import { ArtifactWorkspace } from "@/app/components/artifact-workspace";
import { EnrichSourcesButton } from "@/app/components/enrich-sources-button";
import { NewRunForm } from "@/app/components/new-run-form";
import { PackageValidationPanel } from "@/app/components/package-validation-panel";
import { SourceTranscriptPanel } from "@/app/components/source-transcript-panel";
import { YouTubeFinderPanel } from "@/app/components/youtube-finder-panel";
import { getRunArtifacts } from "@/lib/artifacts";
import { validateProductionPackage, type PackageValidationResult } from "@/lib/package-validation";
import { getRuns, getStageState, type RunSummary } from "@/lib/runs";

export const dynamic = "force-dynamic";

const navItems = [
  { label: "Pipeline", icon: ListChecks, active: true },
  { label: "Sources", icon: FileSearch, active: false },
  { label: "Script", icon: FileText, active: false },
  { label: "Storyboard", icon: Clapperboard, active: false },
  { label: "Media", icon: Image, active: false },
  { label: "Publishing", icon: Upload, active: false },
  { label: "QA", icon: ShieldCheck, active: false },
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

const statusCopy = {
  done: "Done",
  review: "Review",
  blocked: "Blocked",
  pending: "Pending",
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
          <p>Production Ops</p>
        </div>
      </div>

      <section className="nav-section">
        <h2>Workspace</h2>
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
        <h2>Runs</h2>
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
          {runs.length === 0 ? <p className="muted">No runs found</p> : null}
        </div>
      </section>

      <section className="nav-section">
        <h2>Skills</h2>
        <ul className="nav-list">
          {skillItems.map((skill) => (
            <li key={skill} className="nav-item">
              <Sparkles size={15} />
              {skill.replace("youtube-", "")}
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
          <p className="eyebrow">Phase 1</p>
          <h2>Production Workspace</h2>
        </div>
      </div>
      <div className="empty-state">
        <div>
          <Rocket size={34} />
          <h3>No production runs yet</h3>
          <p>New runs appear here as production packages move through the pipeline.</p>
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
    <section className="summary-grid" aria-label="Run summary">
      <div className="stat">
        <p className="stat-label">Sources</p>
        <p className="stat-value">
          <Search size={19} />
          {pkg.sources.length}
        </p>
      </div>
      <div className="stat">
        <p className="stat-label">Claims</p>
        <p className="stat-value">
          <ShieldCheck size={19} />
          {pkg.claim_ledger.length}
        </p>
      </div>
      <div className="stat">
        <p className="stat-label">Scenes</p>
        <p className="stat-value">
          <Clapperboard size={19} />
          {pkg.storyboard.length}
        </p>
      </div>
      <div className="stat">
        <p className="stat-label">Prompts</p>
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
        <h3 className="panel-title">Pipeline</h3>
        <span className="meta">{run.package.qa.status}</span>
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
        <h3 className="panel-title">Source Videos</h3>
        <EnrichSourcesButton runId={run.id} />
      </div>
      <div className="panel-body">
        <table className="source-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Source</th>
              <th>Transcript</th>
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
                <td>{source.transcript_status ?? "not_checked"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <SourceTranscriptPanel runId={run.id} sources={run.package.sources} />
      </div>
    </section>
  );
}

function Inspector({
  run,
  validation,
}: {
  run: RunSummary;
  validation: PackageValidationResult;
}) {
  const brief = run.package.brief;
  return (
    <aside className="inspector">
      <div className="detail-stack">
        <section className="panel">
          <div className="panel-header">
            <h3 className="panel-title">New Run</h3>
            <Rocket size={16} />
          </div>
          <div className="panel-body">
            <NewRunForm />
          </div>
        </section>

        <PackageValidationPanel initialResult={validation} runId={run.id} />

        <section className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Run Brief</h3>
            <BarChart3 size={16} />
          </div>
          <div className="panel-body">
            <div className="detail-stack">
              <div className="detail-row">
                <span>Run</span>
                <span>{run.id}</span>
              </div>
              <div className="detail-row">
                <span>Topic</span>
                <span>{brief.topic}</span>
              </div>
              <div className="detail-row">
                <span>Category</span>
                <span>{brief.category || "Unassigned"}</span>
              </div>
              <div className="detail-row">
                <span>Format</span>
                <span>{brief.format}</span>
              </div>
              <div className="detail-row">
                <span>Language</span>
                <span>{brief.language}</span>
              </div>
              <div className="detail-row">
                <span>Duration</span>
                <span>{brief.target_duration_seconds ?? 0}s</span>
              </div>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h3 className="panel-title">QA Blockers</h3>
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
            <h3 className="panel-title">Assembly</h3>
            <Mic2 size={16} />
          </div>
          <div className="panel-body">
            <div className="detail-stack">
              <div className="detail-row">
                <span>Voice</span>
                <span>pending</span>
              </div>
              <div className="detail-row">
                <span>Subtitles</span>
                <span>pending</span>
              </div>
              <div className="detail-row">
                <span>BGM</span>
                <span>pending</span>
              </div>
              <div className="detail-row">
                <span>Render</span>
                <span>pending</span>
              </div>
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
  const params = searchParams ? await searchParams : {};
  const activeRun = runs.find((run) => run.id === params.run) ?? runs[0];
  const artifacts = activeRun ? await getRunArtifacts(activeRun.id) : [];
  const validation = activeRun ? validateProductionPackage(activeRun.package) : null;

  return (
    <div className="shell">
      <Sidebar runs={runs} activeRun={activeRun} />
      {activeRun ? (
        <main className="main">
          <div className="topbar">
            <div>
              <p className="eyebrow">Phase 1 Production Run</p>
              <h2>{activeRun.package.brief.topic}</h2>
              <p className="muted">
                {activeRun.package.brief.format} / {activeRun.package.brief.language} /{" "}
                {activeRun.package.brief.target_audience || "Audience pending"}
              </p>
            </div>
            <div className="toolbar">
              <button className="icon-button" title="Refresh run data" type="button">
                <RefreshCw size={16} />
              </button>
              <button className="icon-button" title="Open media queue" type="button">
                <Megaphone size={16} />
              </button>
              <AnalysisDraftButton runId={activeRun.id} />
              <button className="text-button primary" type="button">
                <Rocket size={16} />
                QA Gate
              </button>
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
        <Inspector run={activeRun} validation={validation!} />
      ) : (
        <aside className="inspector">
          <section className="panel">
            <div className="panel-header">
              <h3 className="panel-title">New Run</h3>
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
