#!/usr/bin/env bash
set -euo pipefail

identity="${1:-reprogate-deployer}"
registry_alias="${2:-reprogate-registry}"
vault_alias="${3:-reprogate-vault}"
network=testnet
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

(cd "$repo_root/contracts" && cargo test --workspace && stellar contract build)

admin="$(stellar keys address "$identity")"
native_sac="$(stellar contract id asset --asset native --network "$network")"
registry="$(stellar contract deploy --wasm "$repo_root/contracts/target/wasm32v1-none/release/repro_task_registry.wasm" --source "$identity" --network "$network" --alias "$registry_alias" -- --admin "$admin")"
vault="$(stellar contract deploy --wasm "$repo_root/contracts/target/wasm32v1-none/release/reward_vault.wasm" --source "$identity" --network "$network" --alias "$vault_alias" -- --admin "$admin" --token "$native_sac")"

stellar contract invoke --id "$registry" --source "$identity" --network "$network" -- set_vault --vault "$vault"
stellar contract invoke --id "$vault" --source "$identity" --network "$network" -- set_registry --registry "$registry"

stellar contract bindings typescript --contract-id "$registry" --network "$network" --output-dir "$repo_root/web/src/lib/stellar/generated/repro-task-registry" --overwrite
stellar contract bindings typescript --contract-id "$vault" --network "$network" --output-dir "$repo_root/web/src/lib/stellar/generated/reward-vault" --overwrite

printf 'NEXT_PUBLIC_STELLAR_NETWORK=testnet\n'
printf 'NEXT_PUBLIC_REPRO_REGISTRY_CONTRACT_ID=%s\n' "$registry"
printf 'NEXT_PUBLIC_REWARD_VAULT_CONTRACT_ID=%s\n' "$vault"
printf 'NATIVE_XLM_SAC=%s\n' "$native_sac"

