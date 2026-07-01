# Run the full-library pose mesh export (NLF on CUDA).
# Usage (from repo root or this folder):
#   .\tools\pose3d\run-full-export.ps1
#
# Logs go to export-run.log in this directory. Safe to re-run: existing GLBs are skipped.

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$py = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $py)) {
  Write-Error "Missing venv at $py — see README.md for setup."
}

New-Item -ItemType Directory -Force -Path "out-full" | Out-Null
$log = Join-Path $PSScriptRoot "export-run.log"

Write-Host "Logging to $log"
& $py export_glb.py `
  --backend nlf `
  --manifest in-full.json `
  --out-dir out-full `
  --model-path weights/nlf_l_multi.torchscript `
  *>> $log
