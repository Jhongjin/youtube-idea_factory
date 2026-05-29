import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AuthContextPanel } from "@/app/components/auth-context-panel";
import { LoginForm } from "@/app/components/auth-forms";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const user = await getCurrentUser();
  const params = searchParams ? await searchParams : {};
  const nextPath = params.next?.startsWith("/") ? params.next : "/dashboard";

  return (
    <main className="auth-page" id="main-content">
      <div className="auth-topbar">
        <Link className="text-button auth-back" href="/">
          <ArrowLeft size={15} />
          홈으로
        </Link>
      </div>
      <section className="auth-card">
        <AuthContextPanel mode="login" />
        <div className="auth-copy">
          <p className="hero-kicker">보안 워크스페이스</p>
          <h1>워크스페이스 로그인</h1>
          <p>
            승인된 계정 전용 보안 세션입니다. 로그인 후 콘텐츠 대시보드, 채널 관리, AI 인프라
            설정 권한이 활성화됩니다. <span className="auth-admin-hint">초기 관리자 ID: <code>admin</code></span>
          </p>
          {user ? (
            <div className="settings-message saved">
              이미 {user.name} 계정으로 로그인되어 있습니다.
            </div>
          ) : null}
          <LoginForm nextPath={nextPath} />
          <p className="auth-footnote">
            아직 권한 계정이 없으신가요? <Link href="/signup">가입 권한 요청하기</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
