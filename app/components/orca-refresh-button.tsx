"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function OrcaRefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      className="orca-refresh-button"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
      type="button"
    >
      <RefreshCw className={pending ? "orca-spin" : ""} size={15} />
      {pending ? "동기화 중" : "상태 새로고침"}
    </button>
  );
}

