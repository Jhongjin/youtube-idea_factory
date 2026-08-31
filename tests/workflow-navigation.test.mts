import assert from "node:assert/strict";
import test from "node:test";
import { getInitialWorkflowGate, parseGuidedStep } from "../lib/workflow-navigation.ts";

test("an empty source list returns to research before validation", () => {
  assert.equal(getInitialWorkflowGate(0, "fail"), "research");
  assert.equal(getInitialWorkflowGate(0, "pass"), "research");
});

test("validation remains authoritative after sources exist", () => {
  assert.equal(getInitialWorkflowGate(1, "fail"), "validation");
  assert.equal(getInitialWorkflowGate(1, "pass"), "continue");
});

test("only known dashboard steps can override the recommended step", () => {
  assert.equal(parseGuidedStep("research"), "research");
  assert.equal(parseGuidedStep("review"), "review");
  assert.equal(parseGuidedStep("unknown"), undefined);
  assert.equal(parseGuidedStep(undefined), undefined);
});
