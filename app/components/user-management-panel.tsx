"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, UserPlus } from "lucide-react";
import type { AppUser, AppUserStatus } from "@/lib/users";
import type { SessionRole } from "@/lib/session";

const roleLabels: Record<SessionRole, string> = {
  admin: "관리자",
  member: "멤버",
};

const statusLabels: Record<AppUserStatus, string> = {
  active: "활성",
  disabled: "비활성",
  pending: "승인 대기",
};

export function UserManagementPanel({ users }: { users: AppUser[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/users", {
      body: JSON.stringify({
        email: data.get("email"),
        name: data.get("name"),
        password: data.get("password"),
        role: data.get("role"),
        status: data.get("status"),
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setError(body?.error ?? "사용자를 만들지 못했습니다.");
      return;
    }
    event.currentTarget.reset();
    setMessage("사용자를 저장했습니다.");
    router.refresh();
  }

  async function updateUser(event: FormEvent<HTMLFormElement>, userId: string) {
    event.preventDefault();
    setError("");
    setMessage("");
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") ?? "");
    const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
      body: JSON.stringify({
        name: data.get("name"),
        password: password.trim() ? password : undefined,
        role: data.get("role"),
        status: data.get("status"),
      }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setError(body?.error ?? "사용자를 수정하지 못했습니다.");
      return;
    }
    setMessage("사용자 정보를 저장했습니다.");
    router.refresh();
  }

  return (
    <div className="admin-stack">
      <section className="admin-card">
        <div className="admin-card-header">
          <div>
            <h2>회원 만들기</h2>
            <p>팀원이 가입 요청을 보내기 전에도 관리자 계정에서 직접 등록할 수 있습니다.</p>
          </div>
          <UserPlus size={18} />
        </div>
        <form className="admin-form-grid" onSubmit={createUser}>
          <label>
            <span>이름</span>
            <input name="name" placeholder="콘텐츠 운영자" required />
          </label>
          <label>
            <span>이메일</span>
            <input name="email" placeholder="creator@example.com" required type="email" />
          </label>
          <label>
            <span>초기 비밀번호</span>
            <input minLength={8} name="password" placeholder="8자 이상" required type="password" />
          </label>
          <label>
            <span>권한</span>
            <select defaultValue="member" name="role">
              <option value="member">멤버</option>
              <option value="admin">관리자</option>
            </select>
          </label>
          <label>
            <span>상태</span>
            <select defaultValue="active" name="status">
              <option value="active">활성</option>
              <option value="pending">승인 대기</option>
              <option value="disabled">비활성</option>
            </select>
          </label>
          <button className="text-button primary" type="submit">
            <Save size={15} />
            회원 저장
          </button>
        </form>
      </section>

      {error ? <p className="settings-message error">{error}</p> : null}
      {message ? <p className="settings-message saved">{message}</p> : null}

      <section className="admin-card">
        <div className="admin-card-header">
          <div>
            <h2>회원 목록</h2>
            <p>관리자, 멤버, 승인 대기 계정을 한 화면에서 정리합니다.</p>
          </div>
          <span className="admin-count">{users.length}</span>
        </div>
        <div className="user-list">
          {users.map((user) => (
            <form className="user-row" key={user.id} onSubmit={(event) => updateUser(event, user.id)}>
              <div className="user-identity">
                <strong>{user.name}</strong>
                <span>{user.email}</span>
                <small>{user.id === "env-admin" ? "환경변수 관리자" : `최근 로그인 ${user.last_login_at ?? "기록 없음"}`}</small>
              </div>
              <label>
                <span>이름</span>
                <input defaultValue={user.name} disabled={user.id === "env-admin"} name="name" />
              </label>
              <label>
                <span>권한</span>
                <select defaultValue={user.role} disabled={user.id === "env-admin"} name="role">
                  {Object.entries(roleLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>상태</span>
                <select defaultValue={user.status} disabled={user.id === "env-admin"} name="status">
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>새 비밀번호</span>
                <input disabled={user.id === "env-admin"} name="password" placeholder="변경 시 입력" type="password" />
              </label>
              <button className="text-button" disabled={user.id === "env-admin"} type="submit">
                <Save size={15} />
                저장
              </button>
            </form>
          ))}
        </div>
      </section>
    </div>
  );
}
