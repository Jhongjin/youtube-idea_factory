import { ArrowLeft, LockKeyhole } from "lucide-react";
import Link from "next/link";
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
      <Link className="text-button auth-back" href="/">
        <ArrowLeft size={15} />
        홈으로
      </Link>
      <section className="auth-card">
        <div className="auth-art">
          <div className="auth-art-grid">
            <span />
            <span />
            <span />
            <span />
          </div>
          <LockKeyhole size={28} />
        </div>
        <div className="auth-copy">
          <p className="hero-kicker">Operator access</p>
          <h1>아이디와 비밀번호로 로그인</h1>
          <p>
            기존 관리자 토큰 입력창은 제거했습니다. 기본 관리자 아이디는
            <code> admin </code>이고, 비밀번호는 현재 배포의 관리자 비밀번호 또는 기존
            <code> DASHBOARD_ADMIN_TOKEN </code> 값을 사용할 수 있습니다.
          </p>
          {user ? (
            <div className="settings-message saved">
              이미 {user.name} 계정으로 로그인되어 있습니다.
            </div>
          ) : null}
          <LoginForm nextPath={nextPath} />
          <p className="auth-footnote">
            계정이 없다면 <Link href="/signup">가입 요청</Link>을 보내세요.
          </p>
        </div>
      </section>
    </main>
  );
}
