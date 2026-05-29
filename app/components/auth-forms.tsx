"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, KeyRound, LogOut, UserPlus } from "lucide-react";

export function LoginForm({ nextPath = "/dashboard" }: { nextPath?: string }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [action, setAction] = useState<"admin-approval" | "">("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setAction("");
    const response = await fetch("/api/auth/login", {
      body: JSON.stringify({ identifier, password }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const body = (await response.json().catch(() => null)) as {
      action?: "admin-approval";
      error?: string;
    } | null;
    setLoading(false);
    if (!response.ok) {
      setError(body?.error ?? "로그인하지 못했습니다.");
      setAction(body?.action ?? "");
      return;
    }
    router.push(nextPath || "/dashboard");
    router.refresh();
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>
        <span>이메일 또는 관리자 ID</span>
        <input
          autoComplete="username"
          onChange={(event) => setIdentifier(event.target.value)}
          placeholder="admin 또는 you@example.com"
          required
          value={identifier}
        />
      </label>
      <label>
        <span>비밀번호</span>
        <input
          autoComplete="current-password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="비밀번호를 입력해 주세요."
          required
          type="password"
          value={password}
        />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      {action === "admin-approval" ? (
        <div className="auth-inline-guide">
          <strong>관리자 승인 위치</strong>
          <span>관리자 계정으로 로그인한 뒤 회원관리에서 해당 계정의 상태를 활성으로 바꾸면 됩니다.</span>
          <Link href="/login?next=/admin">관리자 로그인 후 회원관리 열기</Link>
        </div>
      ) : null}
      <button className="text-button primary auth-submit" disabled={loading} type="submit">
        <KeyRound size={16} />
        {loading ? "보안 확인 중" : "로그인"}
      </button>
    </form>
  );
}

export function SignupForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => email.trim() && password.length >= 8, [email, password]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    const response = await fetch("/api/auth/signup", {
      body: JSON.stringify({ email, name, password }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const body = (await response.json().catch(() => null)) as {
      error?: string;
      message?: string;
    } | null;
    setLoading(false);
    if (!response.ok) {
      setError(body?.error ?? "가입 요청을 저장하지 못했습니다.");
      return;
    }
    setMessage(body?.message ?? "가입 요청이 접수되었습니다.");
    setName("");
    setEmail("");
    setPassword("");
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>
        <span>이름</span>
        <input
          autoComplete="name"
          onChange={(event) => setName(event.target.value)}
          placeholder="채널 운영자 이름"
          value={name}
        />
      </label>
      <label>
        <span>이메일</span>
        <input
          autoComplete="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          type="email"
          value={email}
        />
      </label>
      <label>
        <span>비밀번호</span>
        <input
          autoComplete="new-password"
          minLength={8}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="8자 이상"
          required
          type="password"
          value={password}
        />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      {message ? (
        <p className="settings-message saved compact">
          <CheckCircle2 size={15} />
          {message}
        </p>
      ) : null}
      {message ? (
        <div className="auth-inline-guide">
          <strong>관리자가 승인하는 방법</strong>
          <span>관리자 계정으로 들어가 회원관리에서 방금 만든 계정의 상태를 활성으로 바꾸세요.</span>
          <Link href="/login?next=/admin">관리자 로그인으로 이동</Link>
        </div>
      ) : null}
      <button className="text-button primary auth-submit" disabled={!canSubmit || loading} type="submit">
        <UserPlus size={16} />
        {loading ? "요청 중" : "가입 요청"}
      </button>
    </form>
  );
}

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <button className="text-button" disabled={loading} onClick={logout} type="button">
      <LogOut size={15} />
      {loading ? "종료 중" : "로그아웃"}
    </button>
  );
}
