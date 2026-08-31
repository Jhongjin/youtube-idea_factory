import assert from "node:assert/strict";
import test from "node:test";
import { mergeCuratedClaimLedger } from "../lib/claim-ledger-merge.ts";

const header = `| Claim | Status | Evidence URL | Confidence | Action | Source |
| --- | --- | --- | --- | --- | --- |`;

test("preserves curated supported and do_not_use rows ahead of LLM rows", () => {
  const current = `${header}
| 공식 근거 주장 | supported | https://example.com/official | 0.98 | Use. | Official |
| 과장 주장 | do_not_use |  | 0 | Block. | Competitor |
| 미검증 주장 | needs_evidence |  | 0 | Verify. | Transcript |`;
  const refined = `# Refined

${header}
| 공식 근거 주장 | needs_evidence |  | 0.4 | Verify. | Transcript |
| 새 주장 | needs_evidence |  | 0.5 | Verify. | Transcript |

## Notes`;

  const merged = mergeCuratedClaimLedger(current, refined);

  assert.match(merged, /공식 근거 주장 \| supported \| https:\/\/example\.com\/official/);
  assert.match(merged, /과장 주장 \| do_not_use/);
  assert.doesNotMatch(merged, /공식 근거 주장 \| needs_evidence/);
  assert.match(merged, /새 주장 \| needs_evidence/);
  assert.ok(merged.indexOf("공식 근거 주장") < merged.indexOf("새 주장"));
});

test("returns the refined ledger unchanged when there are no curated rows", () => {
  const current = `${header}
| 미검증 주장 | needs_evidence |  | 0 | Verify. | Transcript |`;
  const refined = `${header}
| 새 주장 | needs_evidence |  | 0.5 | Verify. | Transcript |`;

  assert.equal(mergeCuratedClaimLedger(current, refined), refined);
});
