"use client";

import { useState, useTransition } from "react";
import { FileJson2, ListPlus, LoaderCircle } from "lucide-react";

export function OrcaJobBuilder({ runDir, suggestedStage, readOnly = false }: { runDir: string; suggestedStage: string | null; readOnly?: boolean }) {
  const stage = suggestedStage;
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [queueMessage, setQueueMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function buildJob() {
    setError("");
    setQueueMessage("");
    startTransition(async () => {
      const response = await fetch("/api/orca/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "build", runDir, stage }),
      });
      const body = (await response.json()) as { job?: Record<string, unknown>; error?: string };
      if (!response.ok || !body.job) {
        setResult(null);
        setError(body.error || "작업 계약을 만들지 못했습니다.");
        return;
      }
      setResult(body.job);
    });
  }

  function enqueueJob() {
    if (!result) return;
    setError("");
    setQueueMessage("");
    startTransition(async () => {
      const response = await fetch("/api/orca/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "enqueue", job: result }),
      });
      const body = (await response.json()) as { created?: boolean; error?: string; record?: { status?: string } };
      if (!response.ok || !body.record) {
        setError(body.error || "작업을 큐에 추가하지 못했습니다.");
        return;
      }
      setQueueMessage(body.created ? "검증된 작업 계약을 대기 큐에 추가했습니다." : "동일한 작업 계약이 이미 큐에 있습니다.");
    });
  }

  return (
    <div className="orca-job-builder">
      <div className="orca-job-fields">
        <label>검증된 재개 단계<strong>{stage || "없음"}</strong></label>
        <button disabled={pending || !stage || readOnly} onClick={buildJob} type="button">
          {pending ? <LoaderCircle className="orca-spin" size={16} /> : <FileJson2 size={16} />}
          작업 계약 확인
        </button>
      </div>
      <p className="orca-help">{readOnly ? "원격 화면은 상태 확인 전용입니다. 작업 계약 생성은 로컬 Orca에서 수행합니다." : "이 버튼은 모델을 실행하지 않습니다. 입력 해시·역할·예산·권한 경계만 확인합니다."}</p>
      {error ? <p className="orca-inline-error">{error}</p> : null}
      {queueMessage ? <p className="orca-queue-message">{queueMessage}</p> : null}
      {result ? (
        <>
          <pre className="orca-job-preview">{JSON.stringify({
            job_id: result.job_id,
            stage: result.stage,
            worker: result.worker,
            expected_outputs: result.expected_outputs,
            permissions: result.permissions,
            idempotency_key: result.idempotency_key,
          }, null, 2)}</pre>
          <button className="orca-queue-button" disabled={pending} onClick={enqueueJob} type="button">
            {pending ? <LoaderCircle className="orca-spin" size={16} /> : <ListPlus size={16} />}
            검증 큐에 추가
          </button>
          <p className="orca-help">큐 등록은 모델을 실행하지 않습니다. worker가 별도로 선점하기 전까지 대기 상태로 보존됩니다.</p>
        </>
      ) : null}
    </div>
  );
}
