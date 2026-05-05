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
import { getDeploymentReadiness, type DeploymentReadiness } from "@/lib/deployment-readiness";
import { getSafeProviderSettings } from "@/lib/provider-settings";
import { providerRoles } from "@/lib/provider-settings-shared";

export const dynamic = "force-dynamic";

function DeploymentStatusPanel({ readiness }: { readiness: DeploymentReadiness }) {
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
                {readiness.security.mutationGate === "token-protected"
                  ? "토큰 보호"
                  : readiness.security.mutationGate === "locked-missing-token"
                    ? "토큰 필요"
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
              return (
                <div className="provider-readiness-card" key={role.id}>
                  <div>
                    <strong>{role.label}</strong>
                    <span>{item.provider || "미선택"}</span>
                  </div>
                  <span className={`readiness-chip ${item.status}`}>{item.message}</span>
                  <p>
                    {item.hasApiKey ? "키 저장됨" : "키 없음"}
                    {item.model ? ` · ${item.model}` : ""}
                  </p>
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
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default async function SettingsPage() {
  const [settings, readiness] = await Promise.all([
    getSafeProviderSettings(),
    getDeploymentReadiness(),
  ]);

  return (
    <main className="settings-page">
      <div className="settings-topbar">
        <Link className="text-button" href="/">
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
      <DeploymentStatusPanel readiness={readiness} />
      <ProviderSettingsForm initialSettings={settings} />
    </main>
  );
}
