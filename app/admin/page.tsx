import { ArrowLeft, Settings, ShieldCheck, Tv, Users } from "lucide-react";
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
  const currentRoleLabel = user.role === "admin" ? "최고 관리자" : "멤버";

  return (
    <main className="admin-page" id="main-content">
      <nav className="admin-nav">
        <Link className="text-button" href="/dashboard">
          <ArrowLeft size={15} />
          대시보드
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
          <p className="hero-kicker">Workspace access control</p>
          <h1>보안 워크스페이스 계정 관제</h1>
          <p>신규 가입 요청을 승인하면 즉시 AI 파이프라인 워크스페이스 접근 권한이 부여됩니다.</p>
        </div>
        <div className="admin-hero-stats">
          <span className="admin-current-account">
            <ShieldCheck size={16} />
            현재 접속 계정: {user.name} ({currentRoleLabel})
          </span>
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
