import { ArrowLeft, Settings, Tv, Users } from "lucide-react";
import Link from "next/link";
import { SupabaseSetupNotice } from "@/app/components/supabase-setup-notice";
import { UserManagementPanel } from "@/app/components/user-management-panel";
import { requireUser } from "@/lib/auth";
import { listYouTubeChannels } from "@/lib/channels";
import { getDeploymentReadiness } from "@/lib/deployment-readiness";
import { listAppUsers } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [user, users, channels, readiness] = await Promise.all([
    requireUser({ redirectTo: "/login?next=/admin", role: "admin" }),
    listAppUsers(),
    listYouTubeChannels(),
    getDeploymentReadiness(),
  ]);

  return (
    <main className="admin-page" id="main-content">
      <nav className="admin-nav">
        <Link className="text-button" href="/dashboard">
          <ArrowLeft size={15} />
          작업장
        </Link>
        <div>
          <Link className="text-button" href="/admin/channels">
            <Tv size={15} />
            채널 관리
          </Link>
          <Link className="text-button" href="/settings">
            <Settings size={15} />
            API 설정
          </Link>
        </div>
      </nav>

      <section className="admin-hero">
        <div>
          <p className="hero-kicker">Admin console</p>
          <h1>회원과 운영 권한을 관리합니다</h1>
          <p>{user.name} 계정으로 접속 중입니다. 승인 대기 회원은 활성 상태로 바꿔야 로그인할 수 있습니다.</p>
        </div>
        <div className="admin-hero-stats">
          <span>
            <Users size={16} />
            회원 {users.length}
          </span>
          <span>
            <Tv size={16} />
            채널 {channels.length}
          </span>
        </div>
      </section>

      <SupabaseSetupNotice readiness={readiness} scope="users" />

      <UserManagementPanel users={users} />
    </main>
  );
}
