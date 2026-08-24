#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token::TokenClient,
    Address, BytesN, Env, MuxedAddress, Vec,
};

const DAY_IN_LEDGERS: u32 = 17_280;
const BUMP_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const BUMP_TO: u32 = 120 * DAY_IN_LEDGERS;
const MAX_CONTRIBUTORS: u32 = 5;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RewardState {
    Funded,
    Completed,
    Refunded,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Reward {
    pub maintainer: Address,
    pub amount: i128,
    pub deadline: u64,
    pub state: RewardState,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Registry,
    Token,
    Reward(BytesN<32>),
    Paid(BytesN<32>, Address),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum VaultError {
    AlreadyConfigured = 1,
    NotConfigured = 2,
    InvalidAmount = 3,
    InvalidDeadline = 4,
    RewardExists = 5,
    RewardNotFound = 6,
    RewardNotFunded = 7,
    InvalidContributors = 8,
    DuplicateContributor = 9,
    AlreadyPaid = 10,
    DeadlinePassed = 11,
    DeadlineNotReached = 12,
}

#[contractevent]
pub struct RewardFunded {
    #[topic]
    pub task_id: BytesN<32>,
    #[topic]
    pub maintainer: Address,
    pub amount: i128,
    pub deadline: u64,
}

#[contractevent]
pub struct RewardDistributionStarted {
    #[topic]
    pub task_id: BytesN<32>,
    pub contributor_count: u32,
    pub total: i128,
}

#[contractevent]
pub struct ContributorPaid {
    #[topic]
    pub task_id: BytesN<32>,
    #[topic]
    pub contributor: Address,
    pub amount: i128,
}

#[contractevent]
pub struct RewardCompleted {
    #[topic]
    pub task_id: BytesN<32>,
    pub total: i128,
}

#[contractevent]
pub struct RewardRefunded {
    #[topic]
    pub task_id: BytesN<32>,
    #[topic]
    pub maintainer: Address,
    pub amount: i128,
}

#[contract]
pub struct RewardVault;

#[contractimpl]
impl RewardVault {
    pub fn __constructor(env: Env, admin: Address, token: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
        bump_instance(&env);
    }

    pub fn set_registry(env: Env, registry: Address) -> Result<(), VaultError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(VaultError::NotConfigured)?;
        admin.require_auth();
        if env.storage().instance().has(&DataKey::Registry) {
            return Err(VaultError::AlreadyConfigured);
        }
        env.storage().instance().set(&DataKey::Registry, &registry);
        bump_instance(&env);
        Ok(())
    }

    pub fn lock(
        env: Env,
        task_id: BytesN<32>,
        maintainer: Address,
        amount: i128,
        deadline: u64,
    ) -> Result<(), VaultError> {
        maintainer.require_auth();
        require_configured(&env)?;
        if amount <= 0 {
            return Err(VaultError::InvalidAmount);
        }
        if deadline <= env.ledger().timestamp() {
            return Err(VaultError::InvalidDeadline);
        }
        let key = DataKey::Reward(task_id.clone());
        if env.storage().persistent().has(&key) {
            return Err(VaultError::RewardExists);
        }

        let token = token_client(&env)?;
        let vault_destination = MuxedAddress::from(env.current_contract_address());
        token.transfer(&maintainer, &vault_destination, &amount);

        let reward = Reward {
            maintainer: maintainer.clone(),
            amount,
            deadline,
            state: RewardState::Funded,
        };
        env.storage().persistent().set(&key, &reward);
        bump_reward(&env, &key);
        RewardFunded {
            task_id,
            maintainer,
            amount,
            deadline,
        }
        .publish(&env);
        Ok(())
    }

    pub fn distribute(
        env: Env,
        task_id: BytesN<32>,
        contributors: Vec<Address>,
    ) -> Result<(), VaultError> {
        let registry: Address = env
            .storage()
            .instance()
            .get(&DataKey::Registry)
            .ok_or(VaultError::NotConfigured)?;
        registry.require_auth();
        bump_instance(&env);

        let key = DataKey::Reward(task_id.clone());
        let mut reward: Reward = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(VaultError::RewardNotFound)?;
        if reward.state != RewardState::Funded {
            return Err(VaultError::RewardNotFunded);
        }
        if env.ledger().timestamp() > reward.deadline {
            return Err(VaultError::DeadlinePassed);
        }
        let count = contributors.len();
        if count == 0 || count > MAX_CONTRIBUTORS || reward.amount < count as i128 {
            return Err(VaultError::InvalidContributors);
        }

        for i in 0..count {
            let contributor = contributors.get(i).unwrap();
            let paid_key = DataKey::Paid(task_id.clone(), contributor.clone());
            if env.storage().persistent().has(&paid_key) {
                return Err(VaultError::AlreadyPaid);
            }
            for j in (i + 1)..count {
                if contributor == contributors.get(j).unwrap() {
                    return Err(VaultError::DuplicateContributor);
                }
            }
        }

        reward.state = RewardState::Completed;
        env.storage().persistent().set(&key, &reward);
        RewardDistributionStarted {
            task_id: task_id.clone(),
            contributor_count: count,
            total: reward.amount,
        }
        .publish(&env);

        let base = reward.amount / count as i128;
        let remainder = reward.amount % count as i128;
        let token = token_client(&env)?;
        let vault = env.current_contract_address();
        for i in 0..count {
            let contributor = contributors.get(i).unwrap();
            let payout = base + if (i as i128) < remainder { 1 } else { 0 };
            let paid_key = DataKey::Paid(task_id.clone(), contributor.clone());
            env.storage().persistent().set(&paid_key, &true);
            bump_reward(&env, &paid_key);
            let destination = MuxedAddress::from(contributor.clone());
            token.transfer(&vault, &destination, &payout);
            ContributorPaid {
                task_id: task_id.clone(),
                contributor,
                amount: payout,
            }
            .publish(&env);
        }
        bump_reward(&env, &key);
        RewardCompleted {
            task_id,
            total: reward.amount,
        }
        .publish(&env);
        Ok(())
    }

    pub fn refund(env: Env, task_id: BytesN<32>) -> Result<(), VaultError> {
        let registry: Address = env
            .storage()
            .instance()
            .get(&DataKey::Registry)
            .ok_or(VaultError::NotConfigured)?;
        registry.require_auth();
        bump_instance(&env);

        let key = DataKey::Reward(task_id.clone());
        let mut reward: Reward = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(VaultError::RewardNotFound)?;
        if reward.state != RewardState::Funded {
            return Err(VaultError::RewardNotFunded);
        }
        if env.ledger().timestamp() <= reward.deadline {
            return Err(VaultError::DeadlineNotReached);
        }

        reward.state = RewardState::Refunded;
        env.storage().persistent().set(&key, &reward);
        let token = token_client(&env)?;
        let destination = MuxedAddress::from(reward.maintainer.clone());
        token.transfer(
            &env.current_contract_address(),
            &destination,
            &reward.amount,
        );
        bump_reward(&env, &key);
        RewardRefunded {
            task_id,
            maintainer: reward.maintainer,
            amount: reward.amount,
        }
        .publish(&env);
        Ok(())
    }

    pub fn get_reward(env: Env, task_id: BytesN<32>) -> Result<Reward, VaultError> {
        let key = DataKey::Reward(task_id);
        let reward = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(VaultError::RewardNotFound)?;
        bump_reward(&env, &key);
        Ok(reward)
    }

    pub fn is_paid(env: Env, task_id: BytesN<32>, contributor: Address) -> bool {
        let key = DataKey::Paid(task_id, contributor);
        let paid = env.storage().persistent().get(&key).unwrap_or(false);
        if paid {
            bump_reward(&env, &key);
        }
        paid
    }
}

fn require_configured(env: &Env) -> Result<(), VaultError> {
    if !env.storage().instance().has(&DataKey::Registry) {
        return Err(VaultError::NotConfigured);
    }
    bump_instance(env);
    Ok(())
}

fn token_client(env: &Env) -> Result<TokenClient<'_>, VaultError> {
    let token = env
        .storage()
        .instance()
        .get(&DataKey::Token)
        .ok_or(VaultError::NotConfigured)?;
    Ok(TokenClient::new(env, &token))
}

fn bump_instance(env: &Env) {
    env.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);
}

fn bump_reward(env: &Env, key: &DataKey) {
    env.storage()
        .persistent()
        .extend_ttl(key, BUMP_THRESHOLD, BUMP_TO);
}

#[cfg(test)]
mod test;
