type LedgerRow = {
  claim: string;
  evidenceUrl: string;
  line: string;
  status: string;
};

function splitCells(row: string) {
  return row
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim().replace(/\\\|/g, "|"));
}

function ledgerRows(markdown: string): LedgerRow[] {
  return markdown
    .split(/\r?\n/)
    .filter((line) => line.startsWith("|") && !line.includes("---") && !line.includes("Claim |"))
    .map((line) => {
      const [claim = "", status = "", evidenceUrl = ""] = splitCells(line);
      return { claim, evidenceUrl, line, status };
    })
    .filter((row) => row.claim.trim());
}

function claimKey(claim: string) {
  return claim
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\s.,!?;:'"“”‘’()[\]{}·…_-]+/g, "");
}

function isCurated(row: LedgerRow) {
  return (row.status === "supported" && Boolean(row.evidenceUrl)) || row.status === "do_not_use";
}

export function mergeCuratedClaimLedger(current: string, refined: string) {
  const curated = ledgerRows(current).filter(isCurated);
  if (curated.length === 0) {
    return refined;
  }

  const refinedRows = ledgerRows(refined);
  const curatedKeys = new Set(curated.map((row) => claimKey(row.claim)));
  const mergedRows = [
    ...curated,
    ...refinedRows.filter((row) => !curatedKeys.has(claimKey(row.claim))),
  ];

  const lines = refined.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.includes("| Claim | Status | Evidence URL |"));
  if (headerIndex < 0 || headerIndex + 1 >= lines.length) {
    return `${refined.trim()}\n\n## Curated Claims Preserved\n\n| Claim | Status | Evidence URL | Confidence | Action | Source |\n| --- | --- | --- | --- | --- | --- |\n${curated.map((row) => row.line).join("\n")}\n`;
  }

  let bodyEnd = headerIndex + 2;
  while (bodyEnd < lines.length && lines[bodyEnd].startsWith("|")) {
    bodyEnd += 1;
  }

  return [
    ...lines.slice(0, headerIndex + 2),
    ...mergedRows.map((row) => row.line),
    ...lines.slice(bodyEnd),
  ].join("\n");
}
