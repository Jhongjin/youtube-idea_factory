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
          <p className="hero-kicker">운영자 로그인</p>
          <h1>제작 운영에 로그인</h1>
          <p>
            승인된 계정만 작업장, 채널 권한, API 설정으로 들어갈 수 있습니다. 기본 관리자 아이디는
            <code>admin</code>입니다.
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
