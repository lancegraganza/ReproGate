extern crate std;

use super::*;
use reward_vault::{RewardVault, RewardVaultClient};
use soroban_sdk::{
    testutils::{Address as _, Events as _, Ledger},
    token::{StellarAssetClient, TokenClient},
};

struct Fixture {
    env: Env,
    registry_id: Address,
    vault_id: Address,
    token_address: Address,
    maintainer: Address,
}

impl Fixture {
    fn registry(&self) -> ReproTaskRegistryClient<'_> {
        ReproTaskRegistryClient::new(&self.env, &self.registry_id)
    }

    fn vault(&self) -> RewardVaultClient<'_> {
        RewardVaultClient::new(&self.env, &self.vault_id)
    }

    fn token(&self) -> TokenClient<'_> {
        TokenClient::new(&self.env, &self.token_address)
    }
}

fn fixture() -> Fixture {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_000);
    let admin = Address::generate(&env);
    let maintainer = Address::generate(&env);
    let issuer = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let token_address = sac.address();
    let token_admin = StellarAssetClient::new(&env, &token_address);

    let registry_id = env.register(ReproTaskRegistry, (admin.clone(),));
    let vault_id = env.register(RewardVault, (admin.clone(), token_address.clone()));
    let registry = ReproTaskRegistryClient::new(&env, &registry_id);
    let vault = RewardVaultClient::new(&env, &vault_id);
    registry.set_vault(&vault_id);
    vault.set_registry(&registry_id);
    token_admin.mint(&maintainer, &1_000_000);

    Fixture {
        env,
        registry_id,
        vault_id,
        token_address,
        maintainer,
    }
}

fn id(env: &Env, byte: u8) -> BytesN<32> {
    BytesN::from_array(env, &[byte; 32])
}

fn fund_and_register(f: &Fixture, task_id: &BytesN<32>, amount: i128, threshold: u32) {
    f.vault().lock(task_id, &f.maintainer, &amount, &2_000u64);
    f.registry()
        .register_task(task_id, &f.maintainer, &amount, &threshold, &2_000u64);
}

#[test]
fn registers_only_matching_funded_task() {
    let f = fixture();
    let task_id = id(&f.env, 1);
    f.vault().lock(&task_id, &f.maintainer, &500, &2_000);
    assert!(f
        .registry()
        .try_register_task(&task_id, &f.maintainer, &499, &2, &2_000)
        .is_err());
    f.registry()
        .register_task(&task_id, &f.maintainer, &500, &2, &2_000);
    assert_eq!(f.registry().get_task(&task_id).state, TaskState::Open);
}

#[test]
fn rejects_invalid_thresholds_and_unfunded_tasks() {
    let f = fixture();
    let task_id = id(&f.env, 2);
    assert!(f
        .registry()
        .try_register_task(&task_id, &f.maintainer, &100, &1, &2_000)
        .is_err());
    assert!(f
        .registry()
        .try_register_task(&task_id, &f.maintainer, &100, &6, &2_000)
        .is_err());
    assert!(f
        .registry()
        .try_register_task(&task_id, &f.maintainer, &100, &2, &2_000)
        .is_err());
}

#[test]
fn finalization_calls_vault_and_pays_multiple_contributors() {
    let f = fixture();
    let task_id = id(&f.env, 3);
    fund_and_register(&f, &task_id, 15, 2);
    let a = Address::generate(&f.env);
    let b = Address::generate(&f.env);
    let contributors = soroban_sdk::vec![&f.env, a.clone(), b.clone()];
    let result_hash = id(&f.env, 99);
    f.registry().finalize(&task_id, &result_hash, &contributors);

    let task = f.registry().get_task(&task_id);
    assert_eq!(task.state, TaskState::Completed);
    assert_eq!(task.result_hash, Some(result_hash));
    assert_eq!(f.token().balance(&a), 8);
    assert_eq!(f.token().balance(&b), 7);
    assert!(f.vault().is_paid(&task_id, &a));
}

#[test]
fn threshold_duplicate_and_replay_guards_hold() {
    let f = fixture();
    let task_id = id(&f.env, 4);
    fund_and_register(&f, &task_id, 100, 2);
    let a = Address::generate(&f.env);
    let hash = id(&f.env, 88);
    assert!(f
        .registry()
        .try_finalize(&task_id, &hash, &soroban_sdk::vec![&f.env, a.clone()])
        .is_err());
    assert!(f
        .registry()
        .try_finalize(&task_id, &hash, &soroban_sdk::vec![&f.env, a.clone(), a])
        .is_err());
    assert_eq!(f.registry().get_task(&task_id).state, TaskState::Open);
}

#[test]
fn expiration_refunds_and_excludes_payout() {
    let f = fixture();
    let task_id = id(&f.env, 5);
    fund_and_register(&f, &task_id, 100, 2);
    assert!(f.registry().try_expire(&task_id).is_err());
    f.env.ledger().set_timestamp(2_001);
    f.registry().expire(&task_id);
    assert_eq!(f.registry().get_task(&task_id).state, TaskState::Expired);
    assert_eq!(f.token().balance(&f.vault_id), 0);
    let contributors =
        soroban_sdk::vec![&f.env, Address::generate(&f.env), Address::generate(&f.env)];
    assert!(f
        .registry()
        .try_finalize(&task_id, &id(&f.env, 1), &contributors)
        .is_err());
}

#[test]
fn events_are_emitted_for_external_state_changes() {
    let f = fixture();
    let task_id = id(&f.env, 6);
    fund_and_register(&f, &task_id, 100, 2);
    assert!(!f.env.events().all().events().is_empty());
}

#[test]
fn maintainer_authorization_is_required_for_registration() {
    let f = fixture();
    let task_id = id(&f.env, 7);
    f.vault().lock(&task_id, &f.maintainer, &100, &2_000);
    f.env.mock_auths(&[]);
    assert!(f
        .registry()
        .try_register_task(&task_id, &f.maintainer, &100, &2, &2_000)
        .is_err());
}
