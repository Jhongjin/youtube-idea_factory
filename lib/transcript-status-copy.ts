import type { SourceVideo } from "@/lib/runs";

export type TranscriptStatusTone = "generated" | "manual" | "missing" | "ready" | "waiting";

export type TranscriptStatusView = {
  detail: string;
  label: string;
  tone: TranscriptStatusTone;
};

const usableTranscriptStatuses = new Set([
  "available",
  "external_transcript",
  "manual_transcript",
  "stt_transcript",
]);

export function hasUsableTranscript(status: string | undefined) {
  return usableTranscriptStatuses.has(status ?? "");
}

function providerCopy(source: SourceVideo) {
  return source.transcript_provider?.trim() || source.transcript_model?.trim() || "";
}

export function getTranscriptStatusView(source: SourceVideo): TranscriptStatusView {
  const status = source.transcript_status ?? "not_checked";
  const provider = providerCopy(source);

  if (status === "manual_transcript") {
    return {
      detail: "제작자가 직접 붙여넣거나 편집한 스크립트입니다.",
      label: "수동 입력",
      tone: "manual",
    };
  }

  if (status === "external_transcript") {
    return {
      detail: provider ? `${provider}로 확보한 자막입니다.` : "자막 API로 확보한 스크립트입니다.",
      label: "외부 자막 확보",
      tone: "ready",
    };
  }

  if (status === "stt_transcript") {
    return {
      detail: provider ? `${provider} STT로 생성한 스크립트입니다.` : "오디오에서 STT로 만든 스크립트입니다.",
      label: "STT 생성",
      tone: "generated",
    };
  }

  if (status === "available") {
    return {
      detail: "분석 입력으로 사용할 수 있는 스크립트가 있습니다.",
      label: "자막 확보",
      tone: "ready",
    };
  }

  if (status === "missing") {
    return {
      detail: source.transcript_error?.trim() || "공개 자막을 찾지 못했거나 가져오기에 실패했습니다.",
      label: "확보 실패",
      tone: "missing",
    };
  }

  return {
    detail: "아직 이 소스의 자막을 확인하지 않았습니다.",
    label: "미확인",
    tone: "waiting",
  };
}
