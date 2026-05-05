$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$failures = New-Object System.Collections.Generic.List[string]

function Require-File {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath (Join-Path $root $Path) -PathType Leaf)) {
    $failures.Add("Missing file: $Path")
  }
}

function Require-Dir {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath (Join-Path $root $Path) -PathType Container)) {
    $failures.Add("Missing directory: $Path")
  }
}

Require-File "AGENTS.md"
Require-File "README.md"
Require-File "MEMORY.md"
Require-File "vercel.json"
Require-File "docs\INDEX.md"
Require-File "docs\PRODUCT_SPEC.md"
Require-File "docs\PIPELINE.md"
Require-File "docs\HARNESS_ARCHITECTURE.md"
Require-File "docs\AGENT_ORCHESTRATION.md"
Require-File "docs\QUALITY_SECURITY.md"
Require-File "docs\DASHBOARD_UX.md"
Require-File "docs\MVP_ROADMAP.md"
Require-File "docs\TECH_DECISIONS.md"
Require-File "docs\PHASE1_RUN_WORKFLOW.md"
Require-File "docs\ADAPTERS.md"
Require-File "docs\DEPLOYMENT.md"
Require-File "docs\templates\approvals.json"
Require-File "docs\templates\provider-settings.local.example.json"
Require-File "docs\templates\production-package.schema.json"
Require-File "docs\templates\supabase-schema.sql"
Require-File "scripts\check_approval_gate.py"
Require-File "scripts\check_deployment_ready.py"
Require-File "scripts\check_provider_ready.py"
Require-File "scripts\create_run.py"
Require-File "scripts\enrich_sources.py"
Require-File "scripts\validate_package.py"
Require-Dir ".agents\skills"
Require-Dir "config"
Require-Dir "runs"
Require-Dir "artifacts"

$skillRoot = Join-Path $root ".agents\skills"
if (Test-Path -LiteralPath $skillRoot -PathType Container) {
  $skills = Get-ChildItem -LiteralPath $skillRoot -Directory
  foreach ($skill in $skills) {
    $skillMd = Join-Path $skill.FullName "SKILL.md"
    if (-not (Test-Path -LiteralPath $skillMd -PathType Leaf)) {
      $failures.Add("Missing SKILL.md: $($skill.Name)")
      continue
    }

    $content = Get-Content -LiteralPath $skillMd -Raw
    if ($content -match "\[TODO") {
      $failures.Add("Unresolved TODO in skill: $($skill.Name)")
    }
    if ($content -notmatch "(?ms)^---\s*`?name`?:\s*.+?description:\s*.+?---") {
      $failures.Add("Invalid frontmatter in skill: $($skill.Name)")
    }
  }
}

$docs = Get-ChildItem -LiteralPath (Join-Path $root "docs") -File -Recurse
foreach ($doc in $docs) {
  $content = Get-Content -LiteralPath $doc.FullName -Raw
  if ($content -match "\[TODO") {
    $relative = $doc.FullName.Substring($root.Length + 1)
    $failures.Add("Unresolved TODO in doc: $relative")
  }
}

if ($failures.Count -gt 0) {
  Write-Host "Harness validation failed:" -ForegroundColor Red
  foreach ($failure in $failures) {
    Write-Host " - $failure" -ForegroundColor Red
  }
  exit 1
}

Write-Host "Harness validation passed." -ForegroundColor Green
