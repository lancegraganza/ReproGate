param(
  [string]$RegistryId = "CAH5OSI255VRSJJQVM6JCR77E5C52IB7Y6WCNZYVC3DH7MDSVMRLHMVI",
  [string]$VaultId = "CDDE25PTGG2XOTQHJ25CIQRUBJ6I6Q4WLIIWSURLLWP26B5HKABWNU5E",
  [string]$MaintainerIdentity = "reprogate-deployer",
  [string]$ContributorAIdentity = "reprogate-student-a",
  [string]$ContributorBIdentity = "reprogate-student-b"
)

$ErrorActionPreference = "Stop"
$rgMaintainer = stellar keys address $MaintainerIdentity
$rgContributorA = stellar keys address $ContributorAIdentity
$rgContributorB = stellar keys address $ContributorBIdentity
$rgDeadline = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds() + 7200
$rgNonce = "reprogate-smoke-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
$rgTaskId = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($rgNonce))).ToLowerInvariant()
$rgResultHash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes("verified-$rgNonce"))).ToLowerInvariant()
$rgContributors = @($rgContributorA, $rgContributorB) | ConvertTo-Json -Compress

stellar contract invoke --id $VaultId --source $MaintainerIdentity --network testnet --auto-sign -- lock --task_id $rgTaskId --maintainer $rgMaintainer --amount 10000000 --deadline $rgDeadline
stellar contract invoke --id $RegistryId --source $MaintainerIdentity --network testnet --auto-sign -- register_task --task_id $rgTaskId --maintainer $rgMaintainer --reward_amount 10000000 --threshold 2 --deadline $rgDeadline
stellar contract invoke --id $RegistryId --source $MaintainerIdentity --network testnet --auto-sign -- finalize --task_id $rgTaskId --result_hash $rgResultHash --contributors $rgContributors
stellar contract invoke --id $RegistryId --source $MaintainerIdentity --network testnet -- get_task --task_id $rgTaskId
stellar contract invoke --id $VaultId --source $MaintainerIdentity --network testnet -- get_reward --task_id $rgTaskId

Write-Output "Smoke task: $rgTaskId"
Write-Output "Result hash: $rgResultHash"
