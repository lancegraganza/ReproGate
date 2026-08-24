extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events as _, Ledger},
    token::{StellarAssetClient, TokenClient},
};

struct Fixture {
    env: Env,
    vault_id: Address,
    token_address: Address,
    maintainer: Address,
    registry: Address,
}

impl Fixture {
    fn client(&self) -> RewardVaultClient<'_> {
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
    let registry = Address::generate(&env);
    let maintainer = Address::generate(&env);
    let issuer = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let token_address = sac.address();
    let token_admin = StellarAssetClient::new(&env, &token_address);
    let vault_id = env.register(RewardVault, (admin, token_address.clone()));
    let client = RewardVaultClient::new(&env, &vault_id);
    client.set_registry(&registry);
    token_admin.mint(&maintainer, &1_000_000);

    Fixture {
        env,
        vault_id,
        token_address,
        maintainer,
        registry,
    }
}

#[test]
fn lock_stores_funded_reward_and_emits_event() {
    let f = fixture();
    let id = BytesN::from_array(&f.env, &[1; 32]);
    f.client().lock(&id, &f.maintainer, &500_000, &2_000);

    let reward = f.client().get_reward(&id);
    assert_eq!(reward.amount, 500_000);
    assert_eq!(reward.maintainer, f.maintainer);
    assert_eq!(reward.state, RewardState::Funded);
    assert_eq!(f.token().balance(&f.vault_id), 500_000);
}

#[test]
fn distribution_splits_remainder_and_prevents_replay() {
    let f = fixture();
    let id = BytesN::from_array(&f.env, &[2; 32]);
    let a = Address::generate(&f.env);
    let b = Address::generate(&f.env);
    let c = Address::generate(&f.env);
    f.client().lock(&id, &f.maintainer, &10, &2_000);
    f.client().distribute(
        &id,
        &soroban_sdk::vec![&f.env, a.clone(), b.clone(), c.clone()],
    );

    assert_eq!(f.token().balance(&a), 4);
    assert_eq!(f.token().balance(&b), 3);
    assert_eq!(f.token().balance(&c), 3);
    assert!(f.client().is_paid(&id, &a));
    assert_eq!(f.client().get_reward(&id).state, RewardState::Completed);
    assert!(f
        .client()
        .try_distribute(&id, &soroban_sdk::vec![&f.env, a])
        .is_err());
}

#[test]
fn refund_only_after_deadline_and_is_exclusive_with_payout() {
    let f = fixture();
    let id = BytesN::from_array(&f.env, &[3; 32]);
    f.client().lock(&id, &f.maintainer, &100, &2_000);
    assert!(f.client().try_refund(&id).is_err());

    f.env.ledger().set_timestamp(2_001);
    f.client().refund(&id);
    assert_eq!(f.client().get_reward(&id).state, RewardState::Refunded);
    assert_eq!(f.token().balance(&f.vault_id), 0);
    assert!(f
        .client()
        .try_distribute(&id, &soroban_sdk::vec![&f.env, Address::generate(&f.env)])
        .is_err());
}

#[test]
fn duplicate_contributors_are_rejected_atomically() {
    let f = fixture();
    let id = BytesN::from_array(&f.env, &[4; 32]);
    let contributor = Address::generate(&f.env);
    f.client().lock(&id, &f.maintainer, &100, &2_000);
    let contributors = soroban_sdk::vec![&f.env, contributor.clone(), contributor];
    assert!(f.client().try_distribute(&id, &contributors).is_err());
    assert_eq!(f.client().get_reward(&id).state, RewardState::Funded);
}

#[test]
fn invalid_amount_and_deadline_are_rejected() {
    let f = fixture();
    let id = BytesN::from_array(&f.env, &[5; 32]);
    assert!(f.client().try_lock(&id, &f.maintainer, &0, &2_000).is_err());
    assert!(f
        .client()
        .try_lock(&id, &f.maintainer, &100, &1_000)
        .is_err());
}

#[test]
fn configuration_is_one_time_and_event_is_observable() {
    let f = fixture();
    assert!(f.client().try_set_registry(&f.registry).is_err());
    let id = BytesN::from_array(&f.env, &[6; 32]);
    f.client().lock(&id, &f.maintainer, &100, &2_000);
    assert!(!f.env.events().all().events().is_empty());
}

#[test]
fn maintainer_authorization_is_required_to_lock() {
    let f = fixture();
    f.env.mock_auths(&[]);
    let id = BytesN::from_array(&f.env, &[7; 32]);
    assert!(f
        .client()
        .try_lock(&id, &f.maintainer, &100, &2_000)
        .is_err());
}
