"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { operatorIssueCopy } from "@/lib/operator-copy";
import type { PackageValidationResult } from "@/lib/package-validation";

const qaStatusCopy: Record<string, string> = {
  pass: "통과",
  blocked: "확인 필요",
  needs_review: "검토 필요",
};

export function PackageValidationPanel({
  runId,
  initialResult,
}: {
  runId: string;
  initialResult: PackageValidationResult;
}) {
  const [result, setResult] = useState(initialResult);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/runs/${runId}/validate`);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "제작 기록 확인에 실패했습니다.");
      setLoading(false);
      return;
    }
    const body = (await response.json()) as { result: PackageValidationResult };
    setResult(body.result);
    setLoading(false);
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h3 className="panel-title">제작 기록 확인</h3>
        <button className="icon-button" onClick={refresh} title="다시 확인" type="button">
          <RefreshCw className={loading ? "spin" : ""} size={15} />
        </button>
      </div>
      <div className="panel-body">
        <div className={`validation-banner ${result.status}`}>
          {result.status === "pass" ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
          <span>{result.status === "pass" ? "구조 통과" : "확인 필요"}</span>
        </div>
        <div className="validation-grid">
          <span>소스</span>
          <strong>{result.summary.sources}</strong>
          <span>주장</span>
          <strong>{result.summary.claims}</strong>
          <span>씬</span>
          <strong>{result.summary.scenes}</strong>
          <span>최종 확인</span>
          <strong>{qaStatusCopy[result.summary.qaStatus] ?? result.summary.qaStatus}</strong>
        </div>
        {result.failures.length > 0 ? (
          <ul className="validation-failures">
            {result.failures.map((failure) => (
              <li key={failure}>{operatorIssueCopy(failure)}</li>
            ))}
          </ul>
        ) : null}
        {error ? <p className="form-error">{error}</p> : null}
      </div>
    </section>
  );
}
