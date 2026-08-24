param(
  [string]$Identity = "reprogate-deployer",
  [string]$RegistryAlias = "reprogate-registry",
  [string]$VaultAlias = "reprogate-vault"
)

$ErrorActionPreference = "Stop"
$rgNetwork = "testnet"

Push-Location (Join-Path $PSScriptRoot "../contracts")
try {
  cargo test --workspace
  if ($LASTEXITCODE -ne 0) { throw "Contract tests failed." }
  stellar contract build
  if ($LASTEXITCODE -ne 0) { throw "Contract build failed." }
} finally {
  Pop-Location
}

$rgRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$rgAdmin = stellar keys address $Identity
$rgNativeSac = stellar contract id asset --asset native --network $rgNetwork
$rgRegistryWasm = Join-Path $rgRoot "contracts/target/wasm32v1-none/release/repro_task_registry.wasm"
$rgVaultWasm = Join-Path $rgRoot "contracts/target/wasm32v1-none/release/reward_vault.wasm"

$rgRegistry = stellar contract deploy --wasm $rgRegistryWasm --source $Identity --network $rgNetwork --alias $RegistryAlias -- --admin $rgAdmin
if ($LASTEXITCODE -ne 0) { throw "Registry deployment failed." }
$rgVault = stellar contract deploy --wasm $rgVaultWasm --source $Identity --network $rgNetwork --alias $VaultAlias -- --admin $rgAdmin --token $rgNativeSac
if ($LASTEXITCODE -ne 0) { throw "Vault deployment failed." }

stellar contract invoke --id $rgRegistry --source $Identity --network $rgNetwork -- set_vault --vault $rgVault
if ($LASTEXITCODE -ne 0) { throw "Registry configuration failed." }
stellar contract invoke --id $rgVault --source $Identity --network $rgNetwork -- set_registry --registry $rgRegistry
if ($LASTEXITCODE -ne 0) { throw "Vault configuration failed." }

stellar contract bindings typescript --contract-id $rgRegistry --network $rgNetwork --output-dir (Join-Path $rgRoot "web/src/lib/stellar/generated/repro-task-registry") --overwrite
stellar contract bindings typescript --contract-id $rgVault --network $rgNetwork --output-dir (Join-Path $rgRoot "web/src/lib/stellar/generated/reward-vault") --overwrite

Write-Output "NEXT_PUBLIC_STELLAR_NETWORK=testnet"
Write-Output "NEXT_PUBLIC_REPRO_REGISTRY_CONTRACT_ID=$rgRegistry"
Write-Output "NEXT_PUBLIC_REWARD_VAULT_CONTRACT_ID=$rgVault"
Write-Output "NATIVE_XLM_SAC=$rgNativeSac"

