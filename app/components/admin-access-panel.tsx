"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, KeyRound, Loader2, Lock, Trash2 } from "lucide-react";

const STORAGE_KEY = "yif.adminToken";
const HEADER_NAME = "X-YIF-Admin-Token";

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}

function shouldAttachToken(input: RequestInfo | URL) {
  try {
    const url = new URL(requestUrl(input), window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

export function AdminAccessPanel() {
  const [token, setToken] = useState("");
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"idle" | "verifying" | "verified" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const storedToken = window.localStorage.getItem(STORAGE_KEY) ?? "";
    setToken(storedToken);
    setDraft(storedToken);
  }, []);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!token || !shouldAttachToken(input)) {
        return originalFetch(input, init);
      }

      const headers = new Headers(init?.headers);
      if (!headers.has(HEADER_NAME)) {
        headers.set(HEADER_NAME, token);
      }

      return originalFetch(input, { ...init, headers });
    }) as typeof window.fetch;

    return () => {
      window.fetch = originalFetch;
    };
  }, [token]);

  const statusText = useMemo(() => {
    if (status === "verifying") {
      return "관리자 토큰 검증 중";
    }
    if (status === "verified") {
      return "토큰 검증 완료. 민감 API 요청에 자동 첨부됩니다.";
    }
    if (status === "error") {
      return message || "토큰 검증 실패";
    }
    return token ? "저장된 토큰이 있습니다. 저장을 눌러 다시 검증할 수 있습니다." : "운영 변경 작업 전 토큰 필요";
  }, [message, status, token]);

  async function verifyToken(nextToken: string) {
    const response = await fetch("/api/admin/verify", {
      method: "POST",
      headers: { [HEADER_NAME]: nextToken },
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? `토큰 검증 실패 (${response.status})`);
    }
  }

  async function saveToken(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextToken = draft.trim();
    if (nextToken) {
      setStatus("verifying");
      setMessage("");
      try {
        await verifyToken(nextToken);
      } catch (error) {
        window.localStorage.removeItem(STORAGE_KEY);
        setToken("");
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "토큰 검증 실패");
        return;
      }

      window.localStorage.setItem(STORAGE_KEY, nextToken);
      setToken(nextToken);
      setStatus("verified");
      return;
    }

    window.localStorage.removeItem(STORAGE_KEY);
    setToken("");
    setStatus("idle");
    setMessage("");
  }

  function clearToken() {
    window.localStorage.removeItem(STORAGE_KEY);
    setDraft("");
    setToken("");
    setStatus("idle");
    setMessage("");
  }

  return (
    <form className="admin-access-panel" onSubmit={saveToken}>
      <div className="admin-access-icon">
        {token ? <KeyRound size={16} /> : <Lock size={16} />}
      </div>
      <label className="admin-access-field">
        <span>관리자 토큰</span>
        <input
          autoComplete="off"
          onChange={(event) => setDraft(event.target.value)}
          placeholder="DASHBOARD_ADMIN_TOKEN"
          type="password"
          value={draft}
        />
      </label>
      <div className="admin-access-actions">
        <button className="text-button primary" disabled={status === "verifying"} type="submit">
          {status === "verifying" ? <Loader2 className="spin" size={15} /> : <CheckCircle2 size={15} />}
          저장
        </button>
        <button className="icon-button" onClick={clearToken} title="토큰 지우기" type="button">
          <Trash2 size={15} />
        </button>
      </div>
      <p className={`admin-access-status ${status}`}>{statusText}</p>
    </form>
  );
}
