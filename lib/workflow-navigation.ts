export const guidedStepKeys = ["setup", "research", "draft", "production", "review"] as const;

export type GuidedStepKey = (typeof guidedStepKeys)[number];

export function parseGuidedStep(value?: string): GuidedStepKey | undefined {
  return guidedStepKeys.find((step) => step === value);
}

export function getInitialWorkflowGate(
  sourceCount: number,
  validationStatus: "pass" | "fail",
): "research" | "validation" | "continue" {
  if (sourceCount === 0) {
    return "research";
  }
  if (validationStatus === "fail") {
    return "validation";
  }
  return "continue";
}
