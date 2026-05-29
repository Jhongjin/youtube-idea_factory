import { ArrowLeft, BadgeCheck, Settings, Tv } from "lucide-react";
import Link from "next/link";
import { LogoutButton } from "@/app/components/auth-forms";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MyPage() {
  const user = await requireUser({ redirectTo: "/login?next=/me" });
  return (
    <main className="account-page" id="main-content">
      <nav className="account-nav">
        <Link className="text-button" href="/dashboard">
          <ArrowLeft size={15} />
          대시보드
        </Link>
        <LogoutButton />
      </nav>

      <section className="account-hero">
        <div>
          <p className="hero-kicker">내 작업 공간</p>
          <h1>{user.name}</h1>
          <p>{user.email}</p>
        </div>
        <span className="account-role">{user.role === "admin" ? "관리자" : "멤버"}</span>
      </section>

      <section className="account-grid">
        <Link className="account-action-card" href="/dashboard">
          <BadgeCheck size={20} />
          <strong>제작 대시보드</strong>
          <span>현재 실행을 열고 다음 버튼을 순서대로 진행합니다.</span>
        </Link>
        <Link className="account-action-card" href="/admin/channels">
          <Tv size={20} />
          <strong>채널 관리</strong>
          <span>브랜드 채널 OAuth와 담당자를 확인합니다.</span>
        </Link>
        <Link className="account-action-card" href="/settings">
          <Settings size={20} />
          <strong>API 설정</strong>
          <span>LLM, 이미지, 영상, TTS API 키와 모델을 조정합니다.</span>
        </Link>
      </section>
    </main>
  );
}
