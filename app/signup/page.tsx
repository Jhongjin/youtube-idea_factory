import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AuthContextPanel } from "@/app/components/auth-context-panel";
import { SignupForm } from "@/app/components/auth-forms";

export const dynamic = "force-dynamic";

export default function SignupPage() {
  return (
    <main className="auth-page" id="main-content">
      <Link className="text-button auth-back" href="/">
        <ArrowLeft size={15} />
        홈으로
      </Link>
      <section className="auth-card signup-card">
        <div className="auth-copy">
          <p className="hero-kicker">Member request</p>
          <h1>제작 운영 계정 요청</h1>
          <p>
            가입 요청은 바로 운영 권한을 주지 않고 승인 대기 상태로 저장됩니다. 관리자가 회원관리에서
            활성화하면 로그인할 수 있습니다.
          </p>
          <SignupForm />
          <p className="auth-footnote">
            이미 계정이 있다면 <Link href="/login">로그인</Link>하세요.
          </p>
        </div>
        <AuthContextPanel mode="signup" />
      </section>
    </main>
  );
}
