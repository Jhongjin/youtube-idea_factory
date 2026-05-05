"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { KeyRound, Lock, Trash2 } from "lucide-react";

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

  const statusText = useMemo(
    () => (token ? "민감 API 요청에 토큰 첨부 중" : "운영 변경 작업 전 토큰 필요"),
    [token],
  );

  function saveToken(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextToken = draft.trim();
    if (nextToken) {
      window.localStorage.setItem(STORAGE_KEY, nextToken);
      setToken(nextToken);
      return;
    }

    window.localStorage.removeItem(STORAGE_KEY);
    setToken("");
  }

  function clearToken() {
    window.localStorage.removeItem(STORAGE_KEY);
    setDraft("");
    setToken("");
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
        <button className="text-button primary" type="submit">
          저장
        </button>
        <button className="icon-button" onClick={clearToken} title="토큰 지우기" type="button">
          <Trash2 size={15} />
        </button>
      </div>
      <p>{statusText}</p>
    </form>
  );
}
