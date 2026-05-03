"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import type { PackageValidationResult } from "@/lib/package-validation";

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
      setError(body?.error ?? "Validation failed.");
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
        <h3 className="panel-title">Package Validation</h3>
        <button className="icon-button" onClick={refresh} title="Refresh validation" type="button">
          <RefreshCw className={loading ? "spin" : ""} size={15} />
        </button>
      </div>
      <div className="panel-body">
        <div className={`validation-banner ${result.status}`}>
          {result.status === "pass" ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
          <span>{result.status === "pass" ? "Structure passed" : "Structure failed"}</span>
        </div>
        <div className="validation-grid">
          <span>Sources</span>
          <strong>{result.summary.sources}</strong>
          <span>Claims</span>
          <strong>{result.summary.claims}</strong>
          <span>Scenes</span>
          <strong>{result.summary.scenes}</strong>
          <span>QA</span>
          <strong>{result.summary.qaStatus}</strong>
        </div>
        {result.failures.length > 0 ? (
          <ul className="validation-failures">
            {result.failures.map((failure) => (
              <li key={failure}>{failure}</li>
            ))}
          </ul>
        ) : null}
        {error ? <p className="form-error">{error}</p> : null}
      </div>
    </section>
  );
}

