import { CheckCircle2, KeyRound, ShieldCheck, UserCheck } from "lucide-react";

export function AuthContextPanel({ mode }: { mode: "login" | "signup" }) {
  const isSignup = mode === "signup";
  return (
    <div className={`auth-product-panel ${isSignup ? "signup-aside" : "auth-art"}`}>
      <div className="auth-console-shell">
        <div className="auth-window-bar" aria-hidden="true">
          <span />
          <span />
          <span />
          <strong>{isSignup ? "승인 대기" : "보안 세션"}</strong>
        </div>
        <div className="auth-console-heading">
          <div>
            {isSignup ? <UserCheck size={24} /> : <ShieldCheck size={24} />}
            <span>{isSignup ? "승인 대기" : "보안 인증"}</span>
          </div>
          {isSignup ? (
            <h2>
              <span className="auth-title-accent">보안 검토</span> 및 승인 후
              <br />
              <span className="auth-title-accent">대시보드 세션</span>이 개방됩니다.
            </h2>
          ) : (
            <h2>
              <span className="auth-title-accent">보안 인증</span>이 완료되면
              <br />
              <span className="auth-title-accent">AI 콘텐츠 관제실</span>이 가동됩니다.
            </h2>
          )}
        </div>

        <div className="auth-console-map" aria-hidden="true">
          <span className="map-lane lane-one" />
          <span className="map-lane lane-two" />
          <span className="map-lane lane-three" />
          <i className="map-node node-one" />
          <i className="map-node node-two" />
          <i className="map-node node-three" />
        </div>

        <div className="auth-stage-stack" aria-label="권한 처리 흐름">
          <div className="auth-stage-row current">
            <strong>01</strong>
            <span>{isSignup ? "가입 요청 저장" : "보안 크레덴셜 검증"}</span>
            <CheckCircle2 size={15} />
          </div>
          <div className="auth-stage-row">
            <strong>02</strong>
            <span>{isSignup ? "최고 관리자 권한 승인" : "워크스페이스 권한 식별"}</span>
            <ShieldCheck size={15} />
          </div>
          <div className="auth-stage-row">
            <strong>03</strong>
            <span>멀티 채널 및 AI 인프라 독립 매핑</span>
            <KeyRound size={15} />
          </div>
        </div>
        <div className="auth-product-footer">
          <span>{isSignup ? "업로드 승인" : "최종 승인 보호"}</span>
          <strong>
            {isSignup
              ? "AI 자동화 파이프라인과 API 비용 발생 단계는 최종 승인 없이는 실행되지 않습니다."
              : "모든 AI 자동화 파이프라인과 API 비용 발생 단계는 귀하의 최종 승인 없이는 절대 실행되지 않으므로 안심하고 로그인하세요."}
          </strong>
        </div>
      </div>
    </div>
  );
}
