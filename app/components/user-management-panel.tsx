"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Save, UserPlus, Zap } from "lucide-react";
import type { AppUser, AppUserStatus } from "@/lib/users";
import type { SessionRole } from "@/lib/session";

const roleLabels: Record<SessionRole, string> = {
  admin: "최고 관리자",
  member: "멤버",
};

const statusLabels: Record<AppUserStatus, string> = {
  active: "활성",
  disabled: "비활성",
  pending: "승인 대기",
};

function UserStatusField({
  defaultStatus,
  disabled,
}: {
  defaultStatus: AppUserStatus;
  disabled?: boolean;
}) {
  const [status, setStatus] = useState<AppUserStatus>(defaultStatus);

  return (
    <label className="status-select-field">
      <span>상태</span>
      <div className={`status-select-shell ${status}`}>
        <i aria-hidden="true" />
        <select
          defaultValue={defaultStatus}
          disabled={disabled}
          name="status"
          onChange={(event) => setStatus(event.target.value as AppUserStatus)}
        >
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

export function UserManagementPanel({ users }: { users: AppUser[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [approvingUserId, setApprovingUserId] = useState("");
  const pendingUsers = users.filter((user) => user.status === "pending");
  const pendingUserCount = pendingUsers.length;
  const orderedUsers = [...pendingUsers, ...users.filter((user) => user.status !== "pending")];

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

  async function approveUser(userId: string) {
    setError("");
    setMessage("");
    setApprovingUserId(userId);
    const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
      body: JSON.stringify({ status: "active" }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    setApprovingUserId("");
    if (!response.ok) {
      setError(body?.error ?? "사용자를 승인하지 못했습니다.");
      return;
    }
    setMessage("가입 요청을 승인했습니다.");
    router.refresh();
  }

  return (
    <div className="admin-stack">
      {error ? <p className="settings-message error">{error}</p> : null}
      {message ? <p className="settings-message saved">{message}</p> : null}

      {pendingUserCount ? (
        <section className="admin-card admin-pending-card" aria-label="승인 대기 회원">
          <div className="admin-card-header">
            <div>
              <h2>승인 대기 {pendingUserCount}명</h2>
              <p>신규 가입 요청을 승인하면 즉시 AI 파이프라인 워크스페이스 접근 권한이 부여됩니다.</p>
            </div>
            <span className="admin-count">먼저 처리</span>
          </div>
          <div className="admin-pending-list">
            {pendingUsers.map((user) => (
              <div className="admin-pending-row" key={user.id}>
                <div>
                  <strong>{user.name}</strong>
                  <span>{user.email}</span>
                </div>
                <button
                  className="text-button approve approve-primary"
                  disabled={approvingUserId === user.id}
                  onClick={() => approveUser(user.id)}
                  type="button"
                >
                  {approvingUserId === user.id ? <CheckCircle2 size={15} /> : <Zap size={15} />}
                  {approvingUserId === user.id ? "승인 중" : "활성으로 승인"}
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="admin-card">
        <div className="admin-card-header">
          <div>
            <h2>회원 목록</h2>
          </div>
          <span className="admin-count">{pendingUserCount ? `대기 ${pendingUserCount}` : users.length}</span>
        </div>
        <div className="user-list">
          {orderedUsers.map((user) => (
            <form className="user-row" key={user.id} onSubmit={(event) => updateUser(event, user.id)}>
              <div className="user-identity">
                <strong>{user.name}</strong>
                <span>{user.email}</span>
                <span className={`user-status-badge ${user.status}`}>
                  <i aria-hidden="true" />
                  {statusLabels[user.status]}
                </span>
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
              <UserStatusField defaultStatus={user.status} disabled={user.id === "env-admin"} />
              <label>
                <span>새 비밀번호</span>
                <input
                  disabled={user.id === "env-admin"}
                  name="password"
                  placeholder="•••••••• (변경 시에만 입력)"
                  type="password"
                />
              </label>
              <div className="user-row-actions">
                {user.status === "pending" ? (
                  <button
                    className="text-button approve"
                    disabled={approvingUserId === user.id}
                    onClick={() => approveUser(user.id)}
                    type="button"
                  >
                    <CheckCircle2 size={15} />
                    {approvingUserId === user.id ? "승인 중" : "승인"}
                  </button>
                ) : null}
                <button className="text-button" disabled={user.id === "env-admin"} type="submit">
                  <Save size={15} />
                  저장
                </button>
              </div>
            </form>
          ))}
        </div>
      </section>

      <details className="admin-card admin-create-user">
        <summary>
          <span>신규 멤버 직접 등록</span>
          <UserPlus size={18} />
        </summary>
        <p>초대 링크 발송 전, 관리자가 워크스페이스에 멤버 계정을 선제적으로 생성하고 권한을 부여할 수 있습니다.</p>
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
          <button className="text-button admin-create-submit" type="submit">
            <Save size={15} />
            회원 저장
          </button>
        </form>
      </details>
    </div>
  );
}
