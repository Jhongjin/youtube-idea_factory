"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Save, ShieldCheck } from "lucide-react";
import type { ApprovalGate, RunApprovals } from "@/lib/approvals";

const gates: Array<{ description: string; id: ApprovalGate; label: string }> = [
  {
    description: "이미지, 영상, 음성 생성 비용을 허용합니다.",
    id: "generation",
    label: "생성",
  },
  {
    description: "최종 영상 조립과 렌더 비용을 허용합니다.",
    id: "render",
    label: "영상 조립",
  },
  {
    description: "YouTube 업로드와 예약 공개를 허용합니다.",
    id: "publish",
    label: "업로드",
  },
];

function formatApprovedAt(value: string) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("ko", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

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
      setError(`${missingApprover.label} 승인에는 승인자가 필요합니다.`);
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
      setError(body?.error ?? "승인 정보 저장에 실패했습니다.");
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
        <h3 className="panel-title">승인</h3>
        <ShieldCheck size={16} />
      </div>
      <div className="panel-body">
        <div className="approval-list">
          {gates.map((gate) => {
            const approval = approvals[gate.id];
            return (
              <div className={`approval-card ${approval.approved ? "approved" : "pending"}`} key={gate.id}>
                <div className="approval-card-header">
                  <label className="approval-toggle">
                    <input
                      checked={approval.approved}
                      onChange={(event) =>
                        updateGate(gate.id, { approved: event.target.checked })
                      }
                      type="checkbox"
                    />
                    <span>
                      <strong>{gate.label}</strong>
                      <small>{gate.description}</small>
                    </span>
                  </label>
                  <span>{approval.approved ? "완료" : "대기"}</span>
                </div>
                {approval.approved ? (
                  <div className="approval-fields">
                    <label>
                      <span>승인자</span>
                      <input
                        aria-label={`${gate.label} 승인자`}
                        onChange={(event) =>
                          updateGate(gate.id, { approved_by: event.target.value })
                        }
                        placeholder="예: JJ"
                        value={approval.approved_by}
                      />
                    </label>
                    <label>
                      <span>메모</span>
                      <textarea
                        aria-label={`${gate.label} 승인 메모`}
                        onChange={(event) => updateGate(gate.id, { notes: event.target.value })}
                        placeholder="승인한 범위나 조건을 짧게 남겨주세요."
                        rows={3}
                        value={approval.notes}
                      />
                    </label>
                  </div>
                ) : null}
                {approval.approved_at ? (
                  <small className="approval-timestamp">{formatApprovedAt(approval.approved_at)}</small>
                ) : null}
              </div>
            );
          })}
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        {saved ? (
          <p className="settings-message saved compact">
            <CheckCircle2 size={14} />
            승인 정보가 저장되었습니다.
          </p>
        ) : null}
        <button className="text-button form-submit" disabled={saving} onClick={save} type="button">
          {saving ? <Loader2 className="spin" size={15} /> : <Save size={15} />}
          승인 내용 저장
        </button>
      </div>
    </section>
  );
}
