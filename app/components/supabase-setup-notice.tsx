import { AlertTriangle, Database } from "lucide-react";
import type { DeploymentReadiness } from "@/lib/deployment-readiness";

export function SupabaseSetupNotice({
  readiness,
  scope = "all",
}: {
  readiness: DeploymentReadiness;
  scope?: "all" | "channels" | "users";
}) {
  if (readiness.runtime.appStorageMode !== "supabase" || !readiness.supabase.schema.checked) {
    return null;
  }

  const missingTables = [
    scope !== "channels" && !readiness.supabase.schema.appUsers ? "app_users" : "",
    scope !== "users" && !readiness.supabase.schema.youtubeChannels ? "youtube_channels" : "",
  ].filter(Boolean);

  if (missingTables.length === 0) {
    return null;
  }

  return (
    <section className="schema-notice" aria-label="Supabase schema setup notice">
      <div className="schema-notice-icon">
        <AlertTriangle size={18} />
      </div>
      <div>
        <p className="schema-notice-kicker">Supabase setup required</p>
        <h2>회원/채널 테이블을 아직 적용해야 합니다</h2>
        <p>
          누락된 테이블: <code>{missingTables.join(", ")}</code>. Supabase Dashboard의 SQL Editor에서{" "}
          <code>docs/templates/supabase-auth-schema.sql</code>을 실행한 뒤 production health endpoint에서
          두 테이블이 <code>true</code>인지 확인하세요.
        </p>
      </div>
      <Database size={18} />
    </section>
  );
}
