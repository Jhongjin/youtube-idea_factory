import "server-only";

import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getAppStorageMode } from "@/lib/storage-mode";
import { isSupabaseMissingTableError, supabaseEq, supabaseRest } from "@/lib/supabase-rest";
import type { SessionRole } from "@/lib/session";

export type AppUserStatus = "active" | "pending" | "disabled";

export type AppUser = {
  created_at: string;
  email: string;
  id: string;
  last_login_at?: string | null;
  name: string;
  role: SessionRole;
  status: AppUserStatus;
  updated_at: string;
};

export type StoredAppUser = AppUser & {
  password_hash: string;
};

type UserStoreFile = {
  users: StoredAppUser[];
};

const appUsersTable = "app_users";
const localUserStorePath = path.join(/* turbopackIgnore: true */ process.cwd(), "config", "app-users.local.json");

function nowIso() {
  return new Date().toISOString();
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function sanitizeUser(user: StoredAppUser): AppUser {
  const { password_hash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

function envAdminUser(): StoredAppUser | null {
  const password =
    process.env.DASHBOARD_ADMIN_PASSWORD?.trim() ||
    process.env.YIF_ADMIN_PASSWORD?.trim() ||
    process.env.DASHBOARD_ADMIN_TOKEN?.trim() ||
    process.env.YIF_ADMIN_TOKEN?.trim() ||
    process.env.ADMIN_ACCESS_TOKEN?.trim();
  if (!password) {
    return null;
  }

  const username = process.env.DASHBOARD_ADMIN_USERNAME?.trim() || "admin";
  const email = normalizeEmail(process.env.DASHBOARD_ADMIN_EMAIL?.trim() || `${username}@local.yif`);
  const timestamp = "system";
  return {
    created_at: timestamp,
    email,
    id: "env-admin",
    last_login_at: null,
    name: process.env.DASHBOARD_ADMIN_NAME?.trim() || "운영 관리자",
    password_hash: `plain:${password}`,
    role: "admin",
    status: "active",
    updated_at: timestamp,
  };
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:v1:${salt}:${hash}`;
}

function verifyPassword(password: string, passwordHash: string) {
  if (passwordHash.startsWith("plain:")) {
    const expected = Buffer.from(passwordHash.slice("plain:".length));
    const actual = Buffer.from(password);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  const [, version, salt, expectedHash] = passwordHash.split(":");
  if (version !== "v1" || !salt || !expectedHash) {
    return false;
  }
  const actualHash = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, "hex");
  return expected.length === actualHash.length && timingSafeEqual(expected, actualHash);
}

async function readLocalUsers(): Promise<StoredAppUser[]> {
  const raw = await fs.readFile(localUserStorePath, "utf-8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") {
      return "";
    }
    throw error;
  });
  if (!raw) {
    return [];
  }
  const parsed = JSON.parse(raw) as UserStoreFile;
  return parsed.users ?? [];
}

async function writeLocalUsers(users: StoredAppUser[]) {
  await fs.mkdir(path.dirname(localUserStorePath), { recursive: true });
  await fs.writeFile(localUserStorePath, `${JSON.stringify({ users }, null, 2)}\n`, "utf-8");
}

async function listStoredUsers(): Promise<StoredAppUser[]> {
  if (getAppStorageMode() === "supabase") {
    return supabaseRest<StoredAppUser[]>(appUsersTable, {
      query: { order: "created_at.desc", select: "*" },
    }).catch((error) => {
      if (isSupabaseMissingTableError(error)) {
        return [];
      }
      throw error;
    });
  }

  return readLocalUsers();
}

async function getStoredUserByEmail(email: string): Promise<StoredAppUser | null> {
  const normalized = normalizeEmail(email);
  if (getAppStorageMode() === "supabase") {
    const rows = await supabaseRest<StoredAppUser[]>(appUsersTable, {
      query: { email: supabaseEq(normalized), limit: 1, select: "*" },
    }).catch((error) => {
      if (isSupabaseMissingTableError(error)) {
        return [];
      }
      throw error;
    });
    return rows[0] ?? null;
  }

  const users = await readLocalUsers();
  return users.find((user) => normalizeEmail(user.email) === normalized) ?? null;
}

export async function listAppUsers(): Promise<AppUser[]> {
  const admin = envAdminUser();
  const users = await listStoredUsers();
  return [...(admin ? [sanitizeUser(admin)] : []), ...users.map(sanitizeUser)];
}

export async function authenticateAppUser(identifier: string, password: string) {
  const login = normalizeEmail(identifier);
  const admin = envAdminUser();
  if (admin) {
    const adminUsername = process.env.DASHBOARD_ADMIN_USERNAME?.trim() || "admin";
    const matchesAdmin = login === normalizeEmail(admin.email) || login === normalizeEmail(adminUsername);
    if (matchesAdmin && verifyPassword(password, admin.password_hash)) {
      return sanitizeUser(admin);
    }
  }

  const user = await getStoredUserByEmail(login);
  if (!user || user.status !== "active" || !verifyPassword(password, user.password_hash)) {
    return null;
  }

  await touchUserLogin(user.id).catch(() => null);
  return sanitizeUser(user);
}

export async function getInactiveAppUserStatus(identifier: string, password: string): Promise<AppUserStatus | null> {
  const login = normalizeEmail(identifier);
  const admin = envAdminUser();
  if (admin) {
    const adminUsername = process.env.DASHBOARD_ADMIN_USERNAME?.trim() || "admin";
    const matchesAdmin = login === normalizeEmail(admin.email) || login === normalizeEmail(adminUsername);
    if (matchesAdmin) {
      return null;
    }
  }

  const user = await getStoredUserByEmail(login);
  if (!user || user.status === "active" || !verifyPassword(password, user.password_hash)) {
    return null;
  }
  return user.status;
}

export async function createAppUser(input: {
  email: string;
  name: string;
  password: string;
  role?: SessionRole;
  status?: AppUserStatus;
}) {
  const email = normalizeEmail(input.email);
  if (!email || !input.password || input.password.length < 8) {
    throw new Error("이메일과 8자 이상의 비밀번호가 필요합니다.");
  }
  const existing = await getStoredUserByEmail(email);
  if (existing || envAdminUser()?.email === email) {
    throw new Error("이미 등록된 이메일입니다.");
  }

  const timestamp = nowIso();
  const user: StoredAppUser = {
    created_at: timestamp,
    email,
    id: randomUUID(),
    last_login_at: null,
    name: input.name.trim() || email.split("@")[0],
    password_hash: hashPassword(input.password),
    role: input.role ?? "member",
    status: input.status ?? "pending",
    updated_at: timestamp,
  };

  if (getAppStorageMode() === "supabase") {
    await supabaseRest<StoredAppUser[]>(appUsersTable, {
      body: user,
      method: "POST",
      prefer: "return=representation",
    }).catch((error) => {
      if (isSupabaseMissingTableError(error)) {
        throw new Error("Supabase app_users 테이블이 필요합니다. docs/templates/supabase-auth-schema.sql을 적용하세요.");
      }
      throw error;
    });
    return sanitizeUser(user);
  }

  const users = await readLocalUsers();
  await writeLocalUsers([user, ...users]);
  return sanitizeUser(user);
}

export async function updateAppUser(
  userId: string,
  input: Partial<Pick<AppUser, "name" | "role" | "status">> & { password?: string },
) {
  if (userId === "env-admin") {
    throw new Error("환경변수 관리자 계정은 코드에서 수정할 수 없습니다.");
  }

  const updates: Partial<StoredAppUser> = {
    updated_at: nowIso(),
  };
  if (input.name !== undefined) {
    updates.name = input.name.trim();
  }
  if (input.role) {
    updates.role = input.role;
  }
  if (input.status) {
    updates.status = input.status;
  }
  if (input.password) {
    if (input.password.length < 8) {
      throw new Error("비밀번호는 8자 이상이어야 합니다.");
    }
    updates.password_hash = hashPassword(input.password);
  }

  if (getAppStorageMode() === "supabase") {
    const rows = await supabaseRest<StoredAppUser[]>(appUsersTable, {
      body: updates,
      method: "PATCH",
      prefer: "return=representation",
      query: { id: supabaseEq(userId) },
    });
    if (!rows[0]) {
      throw new Error("사용자를 찾을 수 없습니다.");
    }
    return sanitizeUser(rows[0]);
  }

  const users = await readLocalUsers();
  const nextUsers = users.map((user) => (user.id === userId ? { ...user, ...updates } : user));
  if (!users.some((user) => user.id === userId)) {
    throw new Error("사용자를 찾을 수 없습니다.");
  }
  await writeLocalUsers(nextUsers);
  return sanitizeUser(nextUsers.find((user) => user.id === userId)!);
}

export async function touchUserLogin(userId: string) {
  if (userId === "env-admin") {
    return;
  }
  const timestamp = nowIso();
  if (getAppStorageMode() === "supabase") {
    await supabaseRest(appUsersTable, {
      body: { last_login_at: timestamp, updated_at: timestamp },
      method: "PATCH",
      query: { id: supabaseEq(userId) },
    });
    return;
  }

  const users = await readLocalUsers();
  await writeLocalUsers(
    users.map((user) =>
      user.id === userId ? { ...user, last_login_at: timestamp, updated_at: timestamp } : user,
    ),
  );
}
