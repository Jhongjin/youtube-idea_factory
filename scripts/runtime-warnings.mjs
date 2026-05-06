export function warnIfInsecureTls() {
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0") {
    return;
  }

  console.error(
    [
      "Warning: NODE_TLS_REJECT_UNAUTHORIZED=0 disables TLS certificate verification.",
      "This is only acceptable for a short local diagnostic run.",
      "PowerShell cleanup: Remove-Item Env:NODE_TLS_REJECT_UNAUTHORIZED -ErrorAction SilentlyContinue",
      "Persistent Windows cleanup: [Environment]::SetEnvironmentVariable('NODE_TLS_REJECT_UNAUTHORIZED', $null, 'User')",
      "Preferred fix: set NODE_OPTIONS to include --use-system-ca or configure NODE_EXTRA_CA_CERTS.",
    ].join("\n"),
  );
}
