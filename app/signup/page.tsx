import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AuthContextPanel } from "@/app/components/auth-context-panel";
import { SignupForm } from "@/app/components/auth-forms";

export const dynamic = "force-dynamic";

export default function SignupPage() {
  return (
    <main className="auth-page" id="main-content">
      <div className="auth-topbar">
        <Link className="text-button auth-back" href="/">
          <ArrowLeft size={15} />
          홈으로
        </Link>
      </div>
      <section className="auth-card signup-card">
        <div className="auth-copy">
          <p className="hero-kicker">WORKSPACE ACCESS</p>
          <h1>워크스페이스 가입 권한 요청</h1>
          <p>
            본 플랫폼은 승인된 크리에이터 및 마케터를 위한 프라이빗 세션입니다. 권한 요청을
            남겨주시면 관리자 검토 후 대시보드 및 멀티 채널 관제실 접근 권한을 활성화해 드립니다.
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
