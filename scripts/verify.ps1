$ErrorActionPreference = "Stop"

if (Test-Path "contracts/Cargo.toml") {
  Push-Location "contracts"
  try {
    cargo test --workspace
    stellar contract build
  } finally {
    Pop-Location
  }
} elseif (Test-Path "Cargo.toml") {
  cargo test --workspace
  stellar contract build
}

function Verify-NodeProject($dir) {
  $pkgPath = Join-Path $dir "package.json"
  if (-not (Test-Path $pkgPath)) { return }

  Push-Location $dir
  try {
    if (Test-Path "pnpm-lock.yaml") { pnpm install --frozen-lockfile }
    $pkg = Get-Content package.json -Raw | ConvertFrom-Json
    $runner = if (Test-Path "pnpm-lock.yaml") { "pnpm" } elseif (Test-Path "yarn.lock") { "yarn" } else { "npm" }
    foreach ($script in @("lint", "typecheck", "test", "build")) {
      if ($pkg.scripts.PSObject.Properties.Name -contains $script) {
        if ($runner -eq "npm") { & npm run $script } else { & $runner $script }
        if ($LASTEXITCODE -ne 0) { throw "$script failed in $dir" }
      }
    }
  } finally {
    Pop-Location
  }
}

Verify-NodeProject "web"
Verify-NodeProject "."

Write-Host "Verification commands completed."
