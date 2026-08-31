[CmdletBinding()]
param(
  [string]$DestinationBase = (Join-Path ([System.IO.Path]::GetTempPath()) "youtube-idea-factory-deploy"),
  [switch]$Validate
)

$ErrorActionPreference = "Stop"
$sourceRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$baseRoot = [System.IO.Path]::GetFullPath($DestinationBase)
$stagingName = "staging-{0}-{1}" -f ([DateTimeOffset]::Now.ToString("yyyyMMdd-HHmmss")), ([Guid]::NewGuid().ToString("N").Substring(0, 8))
$stagingRoot = [System.IO.Path]::GetFullPath((Join-Path $baseRoot $stagingName))

if (-not $stagingRoot.StartsWith($baseRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Staging destination escaped the requested base directory."
}
if (Test-Path -LiteralPath $stagingRoot) {
  throw "Staging destination already exists: $stagingRoot"
}

$directories = @("app", "assets", "docs", "lib", "public", "scripts")
$files = @(
  ".env.example",
  ".gitignore",
  "next-env.d.ts",
  "next.config.ts",
  "package-lock.json",
  "package.json",
  "proxy.ts",
  "README.md",
  "tsconfig.json",
  "vercel.json"
)

New-Item -ItemType Directory -Path $stagingRoot -Force | Out-Null
foreach ($directory in $directories) {
  $source = Join-Path $sourceRoot $directory
  if (-not (Test-Path -LiteralPath $source -PathType Container)) {
    throw "Required deployment directory is missing: $directory"
  }
  Copy-Item -LiteralPath $source -Destination $stagingRoot -Recurse
}
foreach ($file in $files) {
  $source = Join-Path $sourceRoot $file
  if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
    throw "Required deployment file is missing: $file"
  }
  Copy-Item -LiteralPath $source -Destination $stagingRoot
}

$forbidden = @(".git", ".vercel", ".env", ".env.local", "node_modules", ".next", "runs", "artifacts")
foreach ($name in $forbidden) {
  if (Test-Path -LiteralPath (Join-Path $stagingRoot $name)) {
    throw "Forbidden deployment material was copied: $name"
  }
}

$manifest = [ordered]@{
  schema = "youtube-idea-factory-vercel-staging-v1"
  created_at = [DateTimeOffset]::Now.ToString("o")
  source_root = $sourceRoot
  staging_root = $stagingRoot
  copied_directories = $directories
  copied_files = $files
  excluded_sensitive_or_local = $forbidden
  validated = $false
}

if ($Validate) {
  Push-Location $stagingRoot
  try {
    & npm ci
    if ($LASTEXITCODE -ne 0) { throw "npm ci failed in staging copy." }
    & npm run typecheck
    if ($LASTEXITCODE -ne 0) { throw "Typecheck failed in staging copy." }
    & npm run build
    if ($LASTEXITCODE -ne 0) { throw "Build failed in staging copy." }
    $manifest.validated = $true
  } finally {
    Pop-Location
  }
}

$manifestPath = Join-Path $stagingRoot "staging-manifest.json"
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifestPath -Encoding utf8

Write-Output "VERCEL_STAGING=READY"
Write-Output "STAGING_DIR=$stagingRoot"
Write-Output "MANIFEST=$manifestPath"
Write-Output "VALIDATED=$($manifest.validated.ToString().ToLowerInvariant())"
