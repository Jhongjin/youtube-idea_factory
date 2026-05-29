import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Database,
  RadioTower,
  ServerCog,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { ProviderSettingsForm } from "@/app/components/provider-settings-form";
import { requireUser } from "@/lib/auth";
import { getDeploymentReadiness, type DeploymentReadiness } from "@/lib/deployment-readiness";
import { getSafeProviderSettings } from "@/lib/provider-settings";
import {
  providerRoles,
  type ProviderRoleId,
  type SafeProviderSettings,
} from "@/lib/provider-settings-shared";

export const dynamic = "force-dynamic";

function providerRoleSummary(settings: SafeProviderSettings, role: ProviderRoleId) {
  const base = settings.roles[role];
  const profiles = settings.profiles.filter((profile) => profile.role === role);
  const enabledProfiles = profiles.filter((profile) => profile.enabled);
  const enabledCount = Number(base.enabled) + enabledProfiles.length;
  const keyCount = Number(base.hasApiKey) + profiles.filter((profile) => profile.hasApiKey).length;
  const labels = [
    ...(base.enabled ? [`기본 ${base.provider}${base.model ? ` / ${base.model}` : ""}`] : []),
    ...enabledProfiles.map((profile) => `${profile.provider}${profile.model ? ` / ${profile.model}` : ""}`),
  ];
  return {
    enabledCount,
    keyCount,
    labels,
    profileCount: profiles.length,
  };
}

function providerReadinessLabel(status: DeploymentReadiness["providers"]["roles"][ProviderRoleId]["status"]) {
  switch (status) {
    case "ready":
      return "✅ 즉시 자동화 지원";
    case "manual":
      return "🛠️ 수동/외부 워크플로우";
    case "disabled":
      return "⚪ 연결 대기 중";
    case "missing-key":
      return "🔑 보안 키 등록 필요";
    case "missing-model":
      return "모델 선택 필요";
    case "adapter-pending":
    default:
      return "⚪ 커스텀 빌드 대기";
  }
}

function DeploymentStatusPanel({
  readiness,
  settings,
}: {
  readiness: DeploymentReadiness;
  settings: SafeProviderSettings;
}) {
  const schemaReady =
    readiness.supabase.schema.productionRuns &&
    readiness.supabase.schema.runArtifacts &&
    readiness.supabase.schema.runApprovals &&
    readiness.supabase.schema.providerSettings;
  const status = readiness.blockers.length === 0 ? "ready" : "blocked";
  const StatusIcon = status === "ready" ? CheckCircle2 : AlertTriangle;
  const securityReady = readiness.security.mutationGate === "session-protected";
  const durableStorageReady =
    readiness.runtime.appStorageMode === "supabase" &&
    readiness.supabase.durableRunStateEnabled &&
    readiness.supabase.providerSettingsEnabled;

  return (
    <section className="deployment-status panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">클라우드 인프라 및 보안 상태</h2>
          <p className="panel-subtitle">
            실시간 시스템 코어 및 영속성 데이터베이스 연동 상태를 모니터링합니다.
          </p>
        </div>
        <span className={`status-pill ${status === "ready" ? "done" : "blocked"}`}>
          <StatusIcon size={14} />
          {status === "ready" ? "시스템 코어 준비됨" : "인프라 점검 필요"}
        </span>
      </div>
      <div className="panel-body">
        <div className="deployment-status-grid">
          <div className={`deployment-status-card ${status === "ready" ? "ready" : "blocked"}`}>
            <CheckCircle2 size={18} />
            <div>
              <strong>시스템 코어</strong>
              <span>{status === "ready" ? "실시간 준비 완료" : "점검 대기 중"}</span>
            </div>
          </div>
          <div className={`deployment-status-card ${securityReady ? "ready" : "blocked"}`}>
            <ShieldCheck size={18} />
            <div>
              <strong>클라우드 보안 세션</strong>
              <span>{securityReady ? "안전하게 활성화됨" : "보안 키 확인 필요"}</span>
            </div>
          </div>
          <div className={`deployment-status-card ${durableStorageReady ? "ready" : "blocked"}`}>
            <Database size={18} />
            <div>
              <strong>영속 저장소</strong>
              <span>{durableStorageReady ? "연동 완료" : "데이터베이스 확인 필요"}</span>
            </div>
          </div>
          <div className={`deployment-status-card ${readiness.providers.subtitles.supadataReady ? "ready" : "blocked"}`}>
            <RadioTower size={18} />
            <div>
              <strong>자막 수집 엔진</strong>
              <span>{readiness.providers.subtitles.supadataReady ? "연결 완료" : "연결 확인 필요"}</span>
            </div>
          </div>
        </div>

        {!schemaReady ? (
          <p className="settings-message error">
            <AlertTriangle size={15} />
            클라우드 저장소 점검이 필요합니다. 상세 로그는 개발자 모드에서 확인하세요.
          </p>
        ) : null}

        <div className="readiness-section provider-engine-section">
          <div className="readiness-section-header">
            <div>
              <h3>AI 파이프라인 엔진 활성화 현황</h3>
              <p>유튜브 자동화에 필요한 각 단계별 AI 엔진의 연결 상태와 커스텀 빌드 여부를 체크합니다.</p>
            </div>
            <RadioTower size={18} />
          </div>
          <div className="provider-readiness-grid">
            {providerRoles.map((role) => {
              const item = readiness.providers.roles[role.id];
              const summary = providerRoleSummary(settings, role.id);
              return (
                <div className="provider-readiness-card" key={role.id}>
                  <div>
                    <strong>{role.label}</strong>
                    <span>{item.provider || "연결 전"}</span>
                  </div>
                  <span className={`readiness-chip ${item.status}`}>
                    {providerReadinessLabel(item.status)}
                  </span>
                  <p>
                    활성 엔진 {summary.enabledCount}개 · 보안 저장 키 {summary.keyCount}개
                    {item.model ? ` · ${item.model}` : ""}
                  </p>
                  {summary.labels.length > 0 ? (
                    <small className="provider-readiness-profiles">
                      {summary.labels.slice(0, 2).join(" · ")}
                      {summary.labels.length > 2 ? ` 외 ${summary.labels.length - 2}개` : ""}
                    </small>
                  ) : summary.profileCount > 0 ? (
                    <small className="provider-readiness-profiles">
                      추가 슬롯 {summary.profileCount}개가 저장되어 있습니다.
                    </small>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <details className="developer-infra-details">
          <summary>
            <span>🛠️ 개발자 모드 / 시스템 인프라 상세 로그 보기</span>
            <strong>운영자용</strong>
          </summary>
          <div className="developer-infra-body">
            <div className="schema-grid" aria-label="Supabase schema tables">
              <span className={readiness.supabase.schema.productionRuns ? "ready" : "blocked"}>
                production_runs
              </span>
              <span className={readiness.supabase.schema.runArtifacts ? "ready" : "blocked"}>
                run_artifacts
              </span>
              <span className={readiness.supabase.schema.runApprovals ? "ready" : "blocked"}>
                run_approvals
              </span>
              <span className={readiness.supabase.schema.providerSettings ? "ready" : "blocked"}>
                provider_settings
              </span>
              <span className={readiness.supabase.schema.appUsers ? "ready" : "blocked"}>
                app_users
              </span>
              <span className={readiness.supabase.schema.youtubeChannels ? "ready" : "blocked"}>
                youtube_channels
              </span>
            </div>

            {readiness.blockers.length > 0 ? (
              <ul className="deployment-message-list">
                {readiness.blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            ) : null}
            {readiness.warnings.length > 0 ? (
              <ul className="deployment-message-list muted-list">
                {readiness.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}

            <div className="readiness-section">
              <div className="readiness-section-header">
                <div>
                  <h3>외부 작업자 준비도</h3>
                  <p>클라우드 밖에서 영상 조립과 YouTube 업로드 작업을 처리할 환경 요구사항입니다.</p>
                </div>
                <ServerCog size={18} />
              </div>
              <div className="worker-readiness-grid">
                <div className="worker-readiness-card">
                  <div className="worker-readiness-title">
                    <strong>작업자 사전 점검</strong>
                    <span className="readiness-chip manual">CLI</span>
                  </div>
                  <code>
                    npm run ops:worker-doctor -- --storage {readiness.runtime.appStorageMode}
                  </code>
                  <p>ffmpeg, 클라우드 작업 목록, YouTube OAuth, 채널 업로드 토큰을 한 번에 확인합니다.</p>
                </div>
                <div className="worker-readiness-card">
                  <div className="worker-readiness-title">
                    <strong>ffmpeg 영상 조립 작업자</strong>
                    <span className={`readiness-chip ${readiness.workers.render.ready ? "ready" : "missing-key"}`}>
                      {readiness.workers.render.ready ? "작업 처리 가능" : "환경 확인 필요"}
                    </span>
                  </div>
                  <code>{readiness.workers.render.command}</code>
                  <p>{readiness.workers.render.requirements.join(" · ")}</p>
                </div>
                <div className="worker-readiness-card">
                  <div className="worker-readiness-title">
                    <strong>YouTube 업로드 작업자</strong>
                    <span
                      className={`readiness-chip ${
                        readiness.workers.youtubeUpload.ready ? "ready" : "missing-key"
                      }`}
                    >
                      {readiness.workers.youtubeUpload.ready ? "OAuth 준비됨" : "OAuth/작업 목록 확인 필요"}
                    </span>
                  </div>
                  <code>{readiness.workers.youtubeUpload.command}</code>
                  <p>{readiness.workers.youtubeUpload.requirements.join(" · ")}</p>
                  <div className="worker-token-inventory" aria-label="YouTube upload token inventory">
                    <span>전역 {readiness.workers.youtubeUpload.oauthRefreshToken ? "있음" : "없음"}</span>
                    <span>채널 {readiness.workers.youtubeUpload.channelCount}</span>
                    <span>활성 토큰 {readiness.workers.youtubeUpload.activeChannelUploadTokenCount}</span>
                    <span>설정 중 토큰 {readiness.workers.youtubeUpload.setupChannelUploadTokenCount}</span>
                    <span>일시중지 토큰 {readiness.workers.youtubeUpload.pausedChannelUploadTokenCount}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </details>
      </div>
    </section>
  );
}

export default async function SettingsPage() {
  await requireUser({ redirectTo: "/login?next=/settings", role: "admin" });
  const [settings, readiness] = await Promise.all([
    getSafeProviderSettings(),
    getDeploymentReadiness(),
  ]);

  return (
    <main className="settings-page">
      <div className="settings-topbar">
        <Link className="text-button" href="/dashboard">
          <ArrowLeft size={15} />
          대시보드
        </Link>
        <div className="settings-security-note">
          <ShieldCheck size={15} />
          {settings.configPath.startsWith("supabase")
            ? "클라우드 보안 API 설정"
            : "로컬 전용 보안 API 설정"}
        </div>
      </div>
      <DeploymentStatusPanel readiness={readiness} settings={settings} />
      <ProviderSettingsForm initialSettings={settings} />
    </main>
  );
}
