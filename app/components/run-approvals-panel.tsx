"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Save, ShieldCheck } from "lucide-react";
import type { ApprovalGate, RunApprovals } from "@/lib/approvals";

const gates: Array<{ id: ApprovalGate; label: string }> = [
  { id: "generation", label: "Generation" },
  { id: "render", label: "Render" },
  { id: "publish", label: "Publish" },
];

export function RunApprovalsPanel({
  initialApprovals,
  runId,
}: {
  initialApprovals: RunApprovals;
  runId: string;
}) {
  const [approvals, setApprovals] = useState(initialApprovals);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function updateGate(gate: ApprovalGate, patch: Partial<RunApprovals[ApprovalGate]>) {
    setSaved(false);
    setApprovals((current) => ({
      ...current,
      [gate]: {
        ...current[gate],
        ...patch,
      },
    }));
  }

  async function save() {
    const missingApprover = gates.find(
      (gate) => approvals[gate.id].approved && !approvals[gate.id].approved_by.trim(),
    );
    if (missingApprover) {
      setError(`${missingApprover.label} approval needs an approver.`);
      setSaved(false);
      return;
    }

    setSaving(true);
    setError("");
    setSaved(false);
    const response = await fetch(`/api/runs/${runId}/approvals`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvals }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Approvals update failed.");
      setSaving(false);
      return;
    }

    const body = (await response.json()) as { approvals: RunApprovals };
    setApprovals(body.approvals);
    setSaving(false);
    setSaved(true);
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h3 className="panel-title">Approval Gates</h3>
        <ShieldCheck size={16} />
      </div>
      <div className="panel-body">
        <div className="approval-list">
          {gates.map((gate) => {
            const approval = approvals[gate.id];
            return (
              <div className="approval-card" key={gate.id}>
                <label className="provider-toggle">
                  <input
                    checked={approval.approved}
                    onChange={(event) => updateGate(gate.id, { approved: event.target.checked })}
                    type="checkbox"
                  />
                  {gate.label}
                </label>
                <input
                  disabled={!approval.approved}
                  onChange={(event) => updateGate(gate.id, { approved_by: event.target.value })}
                  placeholder="approved by"
                  value={approval.approved_by}
                />
                <textarea
                  onChange={(event) => updateGate(gate.id, { notes: event.target.value })}
                  rows={2}
                  value={approval.notes}
                />
                {approval.approved_at ? <small>{approval.approved_at}</small> : null}
              </div>
            );
          })}
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        {saved ? (
          <p className="settings-message saved compact">
            <CheckCircle2 size={14} />
            Approvals saved.
          </p>
        ) : null}
        <button className="text-button form-submit" disabled={saving} onClick={save} type="button">
          {saving ? <Loader2 className="spin" size={15} /> : <Save size={15} />}
          Save Approvals
        </button>
      </div>
    </section>
  );
}
