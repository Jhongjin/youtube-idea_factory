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
          <strong>{isSignup ? "member queue" : "operator gate"}</strong>
        </div>
        <div className="auth-console-heading">
          <div>
            {isSignup ? <UserCheck size={24} /> : <ShieldCheck size={24} />}
            <span>{isSignup ? "승인 대기열" : "세션 보호"}</span>
          </div>
          <h2>{isSignup ? "요청은 관리자 승인 후 작업장으로 연결됩니다" : "권한이 맞으면 제작 관제실이 열립니다"}</h2>
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
            <span>{isSignup ? "가입 요청 저장" : "아이디와 비밀번호 확인"}</span>
            <CheckCircle2 size={15} />
          </div>
          <div className="auth-stage-row">
            <strong>02</strong>
            <span>{isSignup ? "관리자 회원 승인" : "역할과 상태 확인"}</span>
            <ShieldCheck size={15} />
          </div>
          <div className="auth-stage-row">
            <strong>03</strong>
            <span>채널 OAuth와 제공자 설정 분리</span>
            <KeyRound size={15} />
          </div>
        </div>
        <div className="auth-product-footer">
          <span>upload gate</span>
          <strong>비용과 업로드는 승인 전 실행되지 않습니다.</strong>
        </div>
      </div>
    </div>
  );
}
