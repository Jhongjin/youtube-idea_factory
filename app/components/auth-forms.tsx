"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LogIn, LogOut, UserPlus } from "lucide-react";

export function LoginForm({ nextPath = "/dashboard" }: { nextPath?: string }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      body: JSON.stringify({ identifier, password }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    setLoading(false);
    if (!response.ok) {
      setError(body?.error ?? "로그인하지 못했습니다.");
      return;
    }
    router.push(nextPath || "/dashboard");
    router.refresh();
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>
        <span>아이디 또는 이메일</span>
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
          placeholder="관리자 비밀번호"
          required
          type="password"
          value={password}
        />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="text-button primary auth-submit" disabled={loading} type="submit">
        <LogIn size={16} />
        {loading ? "확인 중" : "로그인"}
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
