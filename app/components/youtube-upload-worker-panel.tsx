"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Clipboard, Terminal } from "lucide-react";

const envVars = [
  "APP_STORAGE_MODE",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ASSETS_BUCKET",
  "YOUTUBE_OAUTH_CLIENT_ID",
  "YOUTUBE_OAUTH_CLIENT_SECRET",
  "YOUTUBE_OAUTH_REFRESH_TOKEN",
];

export function YouTubeUploadWorkerPanel({
  runId,
  storageMode,
  uploadJobStatus,
}: {
  runId: string;
  storageMode: string;
  uploadJobStatus?: string;
}) {
  const [copied, setCopied] = useState<"dry-run" | "upload" | "">("");
  const mode = storageMode === "supabase" ? "supabase" : "local";
  const dryRunCommand = useMemo(
    () =>
      `npm run youtube:upload-worker -- --run-id ${runId} --confirm RUN_YOUTUBE_UPLOAD --storage ${mode} --dry-run`,
    [mode, runId],
  );
  const uploadCommand = useMemo(
    () =>
      `npm run youtube:upload-worker -- --run-id ${runId} --confirm RUN_YOUTUBE_UPLOAD --storage ${mode}`,
    [mode, runId],
  );

  async function copyCommand(kind: "dry-run" | "upload", value: string) {
    await navigator.clipboard.writeText(value).catch(() => null);
    setCopied(kind);
    window.setTimeout(() => setCopied(""), 1500);
  }

  return (
    <section className="worker-panel">
      <div className="worker-panel-header">
        <div>
          <p className="worker-kicker">외부 워커</p>
          <h4>YouTube 업로드</h4>
        </div>
        <span className="status-pill pending">{uploadJobStatus ?? "대기"}</span>
      </div>
      <div className="worker-checklist">
        {envVars.map((name) => (
          <span key={name}>
            <CheckCircle2 size={13} />
            {name}
          </span>
        ))}
      </div>
      <div className="worker-command">
        <div>
          <span>업로드 전 점검</span>
          <code>{dryRunCommand}</code>
        </div>
        <button
          className="icon-button"
          onClick={() => copyCommand("dry-run", dryRunCommand)}
          title="점검 명령 복사"
          type="button"
        >
          {copied === "dry-run" ? <CheckCircle2 size={15} /> : <Clipboard size={15} />}
        </button>
      </div>
      <div className="worker-command">
        <div>
          <span>실제 업로드</span>
          <code>{uploadCommand}</code>
        </div>
        <button
          className="icon-button"
          onClick={() => copyCommand("upload", uploadCommand)}
          title="업로드 명령 복사"
          type="button"
        >
          {copied === "upload" ? <CheckCircle2 size={15} /> : <Clipboard size={15} />}
        </button>
      </div>
      <p className="worker-note">
        <Terminal size={13} />
        Publish Check와 Upload Job 생성 후, 토큰이 있는 로컬/서버 워커에서 실행합니다.
      </p>
    </section>
  );
}
