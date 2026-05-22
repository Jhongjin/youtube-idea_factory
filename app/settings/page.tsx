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

  return (
    <section className="deployment-status panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">배포 및 저장소 상태</h2>
          <p className="panel-subtitle">
            Vercel 환경변수와 Supabase 스키마 적용 상태를 확인합니다.
          </p>
        </div>
        <span className={`status-pill ${status === "ready" ? "done" : "blocked"}`}>
          <StatusIcon size={14} />
          {status === "ready" ? "준비됨" : "조치 필요"}
        </span>
      </div>
      <div className="panel-body">
        <div className="deployment-status-grid">
          <div className="deployment-status-card">
            <Database size={18} />
            <div>
              <strong>저장 모드</strong>
              <span>{readiness.runtime.appStorageMode}</span>
            </div>
          </div>
          <div className="deployment-status-card">
            <ShieldCheck size={18} />
            <div>
              <strong>Supabase 키</strong>
              <span>{readiness.supabase.readyForServerAdapters ? "감지됨" : "필요"}</span>
            </div>
          </div>
          <div className="deployment-status-card">
            <ShieldCheck size={18} />
            <div>
              <strong>관리자 게이트</strong>
              <span>
                {readiness.security.mutationGate === "session-protected"
                  ? "세션 보호"
                  : readiness.security.mutationGate === "locked-missing-session-secret"
                    ? "세션 비밀키 필요"
                    : "로컬 제한 없음"}
              </span>
            </div>
          </div>
          <div className="deployment-status-card">
            <CheckCircle2 size={18} />
            <div>
              <strong>런 영속 저장</strong>
              <span>{readiness.supabase.durableRunStateEnabled ? "준비됨" : "스키마 필요"}</span>
            </div>
          </div>
          <div className="deployment-status-card">
            <CheckCircle2 size={18} />
            <div>
              <strong>제공자 설정 저장</strong>
              <span>{readiness.supabase.providerSettingsEnabled ? "준비됨" : "스키마 필요"}</span>
            </div>
          </div>
          <div className="deployment-status-card">
            <RadioTower size={18} />
            <div>
              <strong>Supadata 자막</strong>
              <span>
                {readiness.providers.subtitles.supadataReady
                  ? "가져오기 가능"
                  : readiness.providers.subtitles.message}
              </span>
            </div>
          </div>
        </div>

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

        {!schemaReady ? (
          <p className="settings-message error">
            <AlertTriangle size={15} />
            Supabase SQL Editor에서 <code>docs/templates/supabase-schema.sql</code>을 적용해야
            실행 기록과 API 설정이 DB에 저장됩니다.
          </p>
        ) : null}

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
              <h3>제공자 준비도</h3>
              <p>현재 선택한 역할별 제공자가 직접 실행 가능한지, 수동 워크플로인지 확인합니다.</p>
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
                    <span>{item.provider || "미선택"}</span>
                  </div>
                  <span className={`readiness-chip ${item.status}`}>{item.message}</span>
                  <p>
                    사용 {summary.enabledCount}개 · 저장 키 {summary.keyCount}개
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

        <div className="readiness-section">
          <div className="readiness-section-header">
            <div>
              <h3>외부 워커 준비도</h3>
              <p>Vercel 밖에서 렌더링과 YouTube 업로드 큐를 처리할 워커 요구사항입니다.</p>
            </div>
            <ServerCog size={18} />
          </div>
          <div className="worker-readiness-grid">
            <div className="worker-readiness-card">
              <div className="worker-readiness-title">
                <strong>워커 사전 점검</strong>
                <span className="readiness-chip manual">CLI</span>
              </div>
              <code>
                npm run ops:worker-doctor -- --storage {readiness.runtime.appStorageMode}
              </code>
              <p>ffmpeg, Supabase 큐, YouTube OAuth, 채널 업로드 토큰을 한 번에 확인합니다.</p>
            </div>
            <div className="worker-readiness-card">
              <div className="worker-readiness-title">
                <strong>ffmpeg 렌더 워커</strong>
                <span className={`readiness-chip ${readiness.workers.render.ready ? "ready" : "missing-key"}`}>
                  {readiness.workers.render.ready ? "큐 처리 가능" : "환경 확인 필요"}
                </span>
              </div>
              <code>{readiness.workers.render.command}</code>
              <p>{readiness.workers.render.requirements.join(" · ")}</p>
            </div>
            <div className="worker-readiness-card">
              <div className="worker-readiness-title">
                <strong>YouTube 업로드 워커</strong>
                <span
                  className={`readiness-chip ${
                    readiness.workers.youtubeUpload.ready ? "ready" : "missing-key"
                  }`}
                >
                  {readiness.workers.youtubeUpload.ready ? "OAuth 준비됨" : "OAuth/큐 확인 필요"}
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
            ? "Supabase 저장 제공자 설정"
            : "로컬 전용 제공자 설정"}
        </div>
      </div>
      <DeploymentStatusPanel readiness={readiness} settings={settings} />
      <ProviderSettingsForm initialSettings={settings} />
    </main>
  );
}
