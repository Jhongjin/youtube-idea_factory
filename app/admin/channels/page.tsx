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
            업로드 {uploadReady}
          </span>
          <span>
            <ShieldCheck size={16} />
            분석 {analyticsReady}
          </span>
        </div>
      </section>

      <SupabaseSetupNotice readiness={readiness} scope="channels" />

      <ChannelManagementPanel channels={channels} />
    </main>
  );
}
