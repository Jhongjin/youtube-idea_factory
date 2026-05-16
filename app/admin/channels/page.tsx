import { ArrowLeft, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { ChannelManagementPanel } from "@/app/components/channel-management-panel";
import { SupabaseSetupNotice } from "@/app/components/supabase-setup-notice";
import { requireUser } from "@/lib/auth";
import { listYouTubeChannels } from "@/lib/channels";
import { getDeploymentReadiness } from "@/lib/deployment-readiness";

export const dynamic = "force-dynamic";

export default async function ChannelsPage() {
  const [user, channels, readiness] = await Promise.all([
    requireUser({ redirectTo: "/login?next=/admin/channels", role: "admin" }),
    listYouTubeChannels(),
    getDeploymentReadiness(),
  ]);
  const uploadReady = channels.filter((channel) => channel.has_upload_refresh_token).length;
  const analyticsReady = channels.filter((channel) => channel.has_analytics_refresh_token).length;
  const activeUploadReady = channels.filter(
    (channel) => channel.status === "active" && channel.has_upload_refresh_token,
  ).length;
  const activationNeeded = channels.filter(
    (channel) => channel.status !== "active" && channel.has_upload_refresh_token,
  ).length;

  return (
    <main className="admin-page channel-page" id="main-content">
      <nav className="admin-nav">
        <Link className="text-button" href="/admin">
          <ArrowLeft size={15} />
          관리자
        </Link>
        <div>
          <Link className="text-button" href="/dashboard">
            작업장
          </Link>
          <Link className="text-button" href="/settings">
            API 설정
          </Link>
        </div>
      </nav>

      <section className="admin-hero channel-admin-hero">
        <div>
          <p className="hero-kicker">Channel authority map</p>
          <h1>브랜드 채널별 OAuth를 분리합니다</h1>
          <p>
            {user.name} 관리자가 채널별 업로드 토큰과 Analytics 토큰 상태를 추적합니다. 10개 브랜드
            채널이라면 이 화면에서 10개 레코드를 관리하면 됩니다.
          </p>
        </div>
        <div className="admin-hero-stats">
          <span>
            <Users size={16} />
            채널 {channels.length}
          </span>
          <span>
            <ShieldCheck size={16} />
            업로드 {activeUploadReady}/{uploadReady}
          </span>
          <span>
            <ShieldCheck size={16} />
            분석 {analyticsReady}
          </span>
        </div>
      </section>

      <SupabaseSetupNotice readiness={readiness} scope="channels" />

      {activationNeeded ? (
        <section className="channel-activation-banner">
          <ShieldCheck size={18} />
          <div>
            <strong>업로드 토큰이 있는 채널 {activationNeeded}개가 아직 운영 중이 아닙니다.</strong>
            <span>채널별 업로드 작업은 상태가 운영 중인 채널만 사용할 수 있습니다.</span>
          </div>
          <Link className="text-button" href="#channel-list">
            전환할 채널 보기
          </Link>
        </section>
      ) : null}

      <ChannelManagementPanel channels={channels} />
    </main>
  );
}
