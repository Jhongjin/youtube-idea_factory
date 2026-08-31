import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  CircleDashed,
  FileCheck2,
  Gauge,
  Layers3,
  LockKeyhole,
  OctagonX,
  RadioTower,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { OrcaJobBuilder } from "@/app/components/orca-job-builder";
import { OrcaRefreshButton } from "@/app/components/orca-refresh-button";
import { requireUser } from "@/lib/auth";
import {
  getOrcaOverview,
  getOrcaBackendMode,
  getOrcaRunState,
  type OrcaChannelPolicy,
  type OrcaMediaQueueRecord,
  type OrcaRenderQueueRecord,
  type OrcaAudioQueueRecord,
  type OrcaPublishQueueRecord,
  type OrcaQueueRecord,
  type OrcaRunState,
  type OrcaRunSummary,
} from "@/lib/orca-control-plane";
import styles from "./orca.module.css";

export const dynamic = "force-dynamic";

const stateCopy = {
  completed: "완료",
  running: "진행 중",
  hold: "중단",
  rejected: "주제 거부",
} as const;

const factModeCopy = {
  strict: "팩트 엄격",
  conditional: "조건부 검증",
  world_bound: "세계관 중심",
} as const;

const stageCopy: Record<string, string> = {
  selection: "주제 확정",
  research: "근거 조사",
  blueprint: "서사 설계",
  blueprint_review: "설계 검수",
  draft: "초안",
  editorial: "편집 검수",
  quality: "품질 보완",
  finalization: "최종 패키지",
  final_gate: "최종 게이트",
  creator_delivery: "제작자 전달",
};
const workerStages = new Set(["research", "blueprint", "blueprint_review", "draft", "editorial", "quality", "finalization"]);
const failureCopy: Record<string, { title: string; detail: string }> = {
  artifact_missing: { title: "필수 산출물 누락", detail: "다음 단계에 필요한 파일이 완성되지 않았습니다." },
  artifact_corrupt: { title: "산출물 검증 실패", detail: "저장된 파일의 형식 또는 무결성을 다시 확인해야 합니다." },
  evidence_insufficient: { title: "근거 부족", detail: "검증 가능한 출처가 부족해 진행을 멈췄습니다." },
  topic_scope_insufficient: { title: "주제 범위 부족", detail: "채널 기준을 충족하도록 주제를 다시 정해야 합니다." },
  provider_quota: { title: "제공자 사용량 제한", detail: "사용량 제한이 풀린 뒤 같은 실행을 재개할 수 있습니다." },
  provider_auth: { title: "제공자 연결 필요", detail: "해당 작업자의 연결 상태를 확인해야 합니다." },
  worker_prompt_stalled: { title: "작업자 응답 중단", detail: "작업자가 결과를 완성하지 못해 안전하게 중단했습니다." },
  worker_launch_failure: { title: "작업자 시작 실패", detail: "작업자를 시작하지 못해 실행 상태를 보존했습니다." },
  policy_mismatch: { title: "채널 정책 불일치", detail: "현재 실행과 채널 정책의 버전을 맞춰야 합니다." },
  gate_validation: { title: "최종 검수 미통과", detail: "필수 검수 항목을 보완한 뒤 재개할 수 있습니다." },
  external_approval: { title: "별도 승인 대기", detail: "외부 제작 또는 게시 단계는 별도 승인이 필요합니다." },
  runtime_failure: { title: "실행 오류", detail: "실행 상태는 보존되었으며 원인을 확인한 뒤 재개할 수 있습니다." },
};

function runHref(channel: string, runDir?: string) {
  const query = new URLSearchParams();
  if (channel) query.set("channel", channel);
  if (runDir) query.set("run", runDir);
  return `/orca?${query.toString()}`;
}

function statusIcon(status: string) {
  if (["completed", "recovered", "inferred_completed"].includes(status)) return <CheckCircle2 size={16} />;
  if (["failed", "blocked", "stale"].includes(status)) return <OctagonX size={16} />;
  return <CircleDashed size={16} />;
}

function Sidebar({
  activeChannel,
  policies,
  runs,
}: {
  activeChannel: string;
  policies: Record<string, OrcaChannelPolicy>;
  runs: OrcaRunSummary[];
}) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <div className={styles.brandMark}><RadioTower size={18} /></div>
        <div><strong>ORCA CONTROL</strong><span>채널 운영 제어판</span></div>
      </div>
      <nav aria-label="주 메뉴" className={styles.primaryNav}>
        <Link className={styles.navItem} href="/dashboard"><Gauge size={16} />Idea Factory</Link>
        <Link className={`${styles.navItem} ${styles.navActive}`} href="/orca"><Layers3 size={16} />Orca 실행</Link>
      </nav>
      <div className={styles.channelSection}>
        <p>채널 정책</p>
        <Link className={!activeChannel ? styles.channelActive : styles.channelLink} href={runHref("")}>
          <span>전체 채널</span><b>{runs.length}</b>
        </Link>
        {Object.entries(policies).map(([slug, policy]) => {
          const count = runs.filter((run) => run.channel === slug).length;
          return (
            <Link className={activeChannel === slug ? styles.channelActive : styles.channelLink} href={runHref(slug)} key={slug}>
              <span><em>{slug}</em><small>{factModeCopy[policy.fact_mode]}</small></span><b>{count}</b>
            </Link>
          );
        })}
      </div>
      <div className={styles.boundaryNote}>
        <LockKeyhole size={17} />
        <div><strong>외부 실행 잠금</strong><span>게시·live n8n·유료 생성은 이 화면에서 실행하지 않습니다.</span></div>
      </div>
    </aside>
  );
}

function RunList({ activeRunDir, channel, runs }: { activeRunDir: string; channel: string; runs: OrcaRunSummary[] }) {
  return (
    <section className={styles.runList} aria-label="실행 목록">
      <div className={styles.sectionHeading}><span>최근 실행</span><b>{runs.length}</b></div>
      <div className={styles.runItems}>
        {runs.map((run) => (
          <Link className={run.run_dir === activeRunDir ? styles.runActive : styles.runItem} href={runHref(channel, run.run_dir)} key={run.run_dir}>
            <div className={styles.runTopline}><span className={`${styles.statusDot} ${styles[run.state]}`} />{stateCopy[run.state]}</div>
            <strong>{run.topic_key || run.run_name}</strong>
            <small>{run.channel} · {run.progress.completed}/{run.progress.total}</small>
          </Link>
        ))}
        {!runs.length ? <p className={styles.empty}>선택한 채널의 확정 실행이 없습니다.</p> : null}
      </div>
    </section>
  );
}

function StageTimeline({ state }: { state: OrcaRunState }) {
  return (
    <div className={styles.timeline}>
      {state.stages.map((stage, index) => (
        <article className={`${styles.stage} ${styles[`stage_${stage.status}`] || ""}`} key={stage.name}>
          <div className={styles.stageRail}><span>{statusIcon(stage.status)}</span>{index < state.stages.length - 1 ? <i /> : null}</div>
          <div className={styles.stageBody}>
            <div><strong>{stageCopy[stage.name] || stage.name}</strong><span>{stage.status}</span></div>
            {stage.stale_reason ? <p>체크포인트 무효: {stage.stale_reason}</p> : null}
            {stage.missing_required.length ? <p>대기 파일: {stage.missing_required.join(", ")}</p> : null}
          </div>
        </article>
      ))}
    </div>
  );
}

const queueStatusCopy: Record<OrcaQueueRecord["status"], string> = {
  queued: "대기", running: "실행 중", completed: "완료", failed: "실패", cancelled: "취소",
};

function QueuePanel({jobs}: {jobs: OrcaQueueRecord[]}) {
  return (
    <section className={styles.queuePanel} aria-label="작업 큐 상태">
      <div className={styles.panelTitle}><div><p>WORKER QUEUE</p><h2>검증 작업 상태</h2></div><b>{jobs.length}</b></div>
      <div className={styles.queueRows}>
        {jobs.slice(0, 8).map((job) => (
          <article key={job.job_id}>
            <span className={`${styles.queueStatus} ${styles[`queue_${job.status}`]}`}>{queueStatusCopy[job.status]}</span>
            <div><strong>{job.channel} · {stageCopy[job.stage] || job.stage}</strong><small>{job.job_id} · 시도 {job.attempts}회</small></div>
            <p>{job.last_error || (job.worker_id ? `작업자 ${job.worker_id}` : "검증된 계약 대기")}</p>
          </article>
        ))}
        {!jobs.length ? <p className={styles.empty}>등록된 작업 계약이 없습니다.</p> : null}
      </div>
    </section>
  );
}

function MediaQueuePanel({jobs}: {jobs: OrcaMediaQueueRecord[]}) {
  return (
    <section className={styles.queuePanel} aria-label="미디어 생성 큐 상태">
      <div className={styles.panelTitle}><div><p>MEDIA QUEUE</p><h2>이미지·영상 제작 상태</h2></div><b>{jobs.length}</b></div>
      <div className={styles.queueRows}>
        {jobs.slice(0, 8).map((job) => (
          <article key={job.job_id}>
            <span className={`${styles.queueStatus} ${styles[`queue_${job.status}`]}`}>{queueStatusCopy[job.status]}</span>
            <div><strong>{job.channel} · {job.scene_id} · {job.media_kind === "image" ? "이미지" : "영상"}</strong><small>{job.provider} · 시도 {job.attempts}회</small></div>
            <p>{job.last_error || (job.worker_id ? `작업자 ${job.worker_id}` : "승인 대기 중인 검증 계약")}</p>
          </article>
        ))}
        {!jobs.length ? <p className={styles.empty}>등록된 미디어 작업 계약이 없습니다.</p> : null}
      </div>
    </section>
  );
}

function ProductionQueuePanel({renderJobs, audioJobs, publishJobs}: {renderJobs: OrcaRenderQueueRecord[]; audioJobs: OrcaAudioQueueRecord[]; publishJobs: OrcaPublishQueueRecord[]}) {
  const rows = [
    ...audioJobs.map((job) => ({...job, label: job.role === "voice" ? "TTS 음성" : "배경음악", detail: `${job.provider} · 권리 검토 후 렌더 가능`})),
    ...renderJobs.map((job) => ({...job, label: job.purpose === "final" ? "최종 렌더" : "미리보기 렌더", detail: "Remotion 로컬 렌더 · 게시 권한 없음"})),
    ...publishJobs.map((job) => ({...job, label: job.phase === "private_upload" ? "YouTube 비공개 업로드" : "공개 상태 전환", detail: job.phase === "private_upload" ? "비공개 업로드 전용 승인 필요" : "두 번째 공개 승인 필요"})),
  ].sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  return (
    <section className={styles.queuePanel} aria-label="오디오 및 렌더 큐 상태">
      <div className={styles.panelTitle}><div><p>PRODUCTION QUEUE</p><h2>오디오·렌더 상태</h2></div><b>{rows.length}</b></div>
      <div className={styles.queueRows}>
        {rows.slice(0, 10).map((job) => (
          <article key={job.job_id}>
            <span className={`${styles.queueStatus} ${styles[`queue_${job.status}`]}`}>{queueStatusCopy[job.status]}</span>
            <div><strong>{job.channel} · {job.label}</strong><small>{job.job_id} · 시도 {job.attempts}회</small></div>
            <p>{job.last_error || (job.worker_id ? `작업자 ${job.worker_id}` : job.detail)}</p>
          </article>
        ))}
        {!rows.length ? <p className={styles.empty}>등록된 오디오·렌더 작업 계약이 없습니다.</p> : null}
      </div>
    </section>
  );
}

export default async function OrcaControlPage({
  searchParams,
}: {
  searchParams?: Promise<{ channel?: string; run?: string }>;
}) {
  await requireUser({ redirectTo: "/login?next=/orca" });
  const backendMode = getOrcaBackendMode();
  const params = searchParams ? await searchParams : {};
  const activeChannel = params.channel?.trim() || "";
  let runs: OrcaRunSummary[] = [];
  let policies: Record<string, OrcaChannelPolicy> = {};
  let policyVersion = "";
  let queueJobs: OrcaQueueRecord[] = [];
  let mediaQueueJobs: OrcaMediaQueueRecord[] = [];
  let renderQueueJobs: OrcaRenderQueueRecord[] = [];
  let audioQueueJobs: OrcaAudioQueueRecord[] = [];
  let publishQueueJobs: OrcaPublishQueueRecord[] = [];
  let connectionError = "";

  try {
    const overview = await getOrcaOverview();
    runs = overview.runs;
    policies = overview.policies.channels;
    policyVersion = overview.policies.version;
    queueJobs = overview.queue;
    mediaQueueJobs = overview.mediaQueue;
    renderQueueJobs = overview.renderQueue;
    audioQueueJobs = overview.audioQueue;
    publishQueueJobs = overview.publishQueue;
  } catch (error) {
    connectionError = error instanceof Error ? error.message : "Gate Service에 연결할 수 없습니다.";
  }

  const filteredRuns = activeChannel ? runs.filter((run) => run.channel === activeChannel) : runs;
  const requestedRun = runs.find((run) => run.run_dir === params.run);
  const activeSummary = requestedRun && (!activeChannel || requestedRun.channel === activeChannel)
    ? requestedRun
    : filteredRuns[0];
  let activeState: OrcaRunState | null = null;
  if (activeSummary) {
    try { activeState = await getOrcaRunState(activeSummary.run_dir); }
    catch (error) { connectionError = error instanceof Error ? error.message : "실행 상태를 읽지 못했습니다."; }
  }
  const activePolicy = activeState ? policies[activeState.channel] : null;
  const completedCount = filteredRuns.filter((run) => run.state === "completed").length;
  const holdCount = filteredRuns.filter((run) => run.state === "hold" || run.state === "rejected").length;
  const queuedCount = queueJobs.filter((job) => job.status === "queued").length;
  const visibleQueueJobs = activeChannel ? queueJobs.filter((job) => job.channel === activeChannel) : queueJobs;
  const visibleMediaQueueJobs = activeChannel ? mediaQueueJobs.filter((job) => job.channel === activeChannel) : mediaQueueJobs;
  const visibleRenderQueueJobs = activeChannel ? renderQueueJobs.filter((job) => job.channel === activeChannel) : renderQueueJobs;
  const visibleAudioQueueJobs = activeChannel ? audioQueueJobs.filter((job) => job.channel === activeChannel) : audioQueueJobs;
  const visiblePublishQueueJobs = activeChannel ? publishQueueJobs.filter((job) => job.channel === activeChannel) : publishQueueJobs;

  return (
    <div className={styles.shell}>
      <Sidebar activeChannel={activeChannel} policies={policies} runs={runs} />
      <RunList activeRunDir={activeSummary?.run_dir || ""} channel={activeChannel} runs={filteredRuns} />
      <main className={styles.main} id="main-content">
        <header className={styles.header}>
          <div><p>ORCA / CONTROL PLANE</p><h1>{activeState?.topic_key || "실행 상태"}</h1><span>{backendMode === "supabase" ? "동기화된 Orca 정책·실행·큐 상태를 안전하게 확인합니다." : "로컬 산출물·해시·게이트 판정을 한 화면에서 확인합니다."}</span></div>
          <OrcaRefreshButton />
        </header>

        {connectionError ? (
          <section className={styles.serviceError}>
            <AlertTriangle size={20} />
            <div><strong>Orca control-plane이 응답하지 않습니다.</strong><p>{connectionError}</p><code>{backendMode === "supabase" ? "Supabase mirror schema and sync worker" : "node platform/gate-service.mjs"}</code></div>
          </section>
        ) : null}

        <section className={styles.stats}>
          <article><span>표시 실행</span><strong>{filteredRuns.length}</strong><small>최근 40개 이내</small></article>
          <article><span>제작자 전달 완료</span><strong>{completedCount}</strong><small>해시 무결성 포함</small></article>
          <article><span>확인 필요</span><strong>{holdCount}</strong><small>중단·주제 거부</small></article>
          <article><span>작업 대기열</span><strong>{queuedCount + mediaQueueJobs.filter((job) => job.status === "queued").length + renderQueueJobs.filter((job) => job.status === "queued").length + audioQueueJobs.filter((job) => job.status === "queued").length + publishQueueJobs.filter((job) => job.status === "queued").length}</strong><small>LLM부터 승인형 게시까지 합계</small></article>
          <article><span>정책 버전</span><strong className={styles.version}>{policyVersion || "—"}</strong><small>채널별 역할 라우팅</small></article>
        </section>

        {!connectionError ? <QueuePanel jobs={visibleQueueJobs} /> : null}
        {!connectionError ? <MediaQueuePanel jobs={visibleMediaQueueJobs} /> : null}
        {!connectionError ? <ProductionQueuePanel renderJobs={visibleRenderQueueJobs} audioJobs={visibleAudioQueueJobs} publishJobs={visiblePublishQueueJobs} /> : null}

        {activeState ? (
          <>
            <section className={styles.runBanner}>
              <div className={`${styles.stateBadge} ${styles[activeState.state]}`}>{stateCopy[activeState.state]}</div>
              <div><span>다음 단계</span><strong>{stageCopy[activeState.resume_from || ""] || activeState.resume_from || "없음"}</strong></div>
              <div><span>팩트 모드</span><strong>{activePolicy ? factModeCopy[activePolicy.fact_mode] : activeState.fact_mode}</strong></div>
              <div><span>진행률</span><strong>{activeSummary?.progress.completed || 0} / {activeSummary?.progress.total || activeState.stages.length}</strong></div>
            </section>

            <div className={styles.workspace}>
              <section className={styles.pipelinePanel}>
                <div className={styles.panelTitle}><div><p>파이프라인</p><h2>검증된 단계 기록</h2></div><FileCheck2 size={20} /></div>
                <StageTimeline state={activeState} />
              </section>
              <aside className={styles.inspector}>
                <section>
                  <div className={styles.panelTitle}><div><p>INSPECTOR</p><h2>판정 근거</h2></div><ShieldCheck size={20} /></div>
                  <dl className={styles.facts}>
                    <div><dt>채널</dt><dd>{activeState.channel}</dd></div>
                    <div><dt>실행 ID</dt><dd>{activeState.run_id}</dd></div>
                    <div><dt>정책</dt><dd>{activeState.policy_version || policyVersion}</dd></div>
                    <div><dt>원본</dt><dd>Orca run folder</dd></div>
                  </dl>
                </section>
                {activeState.failure ? (
                  <section className={styles.failureCard}>
                    <p>중단 분류</p><h3>{failureCopy[activeState.failure.class]?.title || "확인 필요"}</h3>
                    <span>{failureCopy[activeState.failure.class]?.detail || "실행 상태를 보존했습니다. 운영 기록에서 원인을 확인해 주세요."}</span>
                    <div><b>{activeState.failure.retryable ? "동일 실행 재개 가능" : "동일 조건 재시도 금지"}</b></div>
                  </section>
                ) : null}
                {activeState.state !== "completed" && activeState.state !== "rejected" && workerStages.has(activeState.resume_from || "") ? (
                  <section className={styles.jobCard}>
                    <p>WORKER CONTRACT</p><h3>다음 작업 명세</h3>
                    <OrcaJobBuilder runDir={activeSummary?.run_dir || ""} suggestedStage={activeState.resume_from} readOnly={backendMode === "supabase"} />
                  </section>
                ) : null}
                <Link className={styles.openDashboard} href="/dashboard"><span>기존 Idea Factory 열기</span><ArrowUpRight size={16} /></Link>
              </aside>
            </div>
          </>
        ) : !connectionError ? (
          <section className={styles.emptyWorkspace}><Layers3 size={28} /><h2>표시할 실행이 없습니다.</h2><p>Orca에서 주제를 확정하면 이곳에 자동으로 나타납니다.</p></section>
        ) : null}
      </main>
    </div>
  );
}
