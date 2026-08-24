#![no_std]

use soroban_sdk::{
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype, Address,
    BytesN, Env, Vec,
};

const DAY_IN_LEDGERS: u32 = 17_280;
const BUMP_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const BUMP_TO: u32 = 120 * DAY_IN_LEDGERS;
const MIN_THRESHOLD: u32 = 2;
const MAX_THRESHOLD: u32 = 5;
const MAX_DEADLINE_SECONDS: u64 = 90 * 24 * 60 * 60;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum TaskState {
    Open,
    Completed,
    Expired,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Task {
    pub maintainer: Address,
    pub reward_amount: i128,
    pub threshold: u32,
    pub deadline: u64,
    pub state: TaskState,
    pub result_hash: Option<BytesN<32>>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum VaultRewardState {
    Funded,
    Completed,
    Refunded,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VaultReward {
    pub maintainer: Address,
    pub amount: i128,
    pub deadline: u64,
    pub registered: bool,
    pub state: VaultRewardState,
}

#[contractclient(name = "RewardVaultClient")]
pub trait RewardVaultInterface {
    fn get_reward(env: Env, task_id: BytesN<32>) -> Result<VaultReward, RegistryError>;
    fn activate(env: Env, task_id: BytesN<32>) -> Result<(), RegistryError>;
    fn distribute(
        env: Env,
        task_id: BytesN<32>,
        contributors: Vec<Address>,
    ) -> Result<(), RegistryError>;
    fn refund(env: Env, task_id: BytesN<32>) -> Result<(), RegistryError>;
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Vault,
    Task(BytesN<32>),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum RegistryError {
    AlreadyConfigured = 1,
    NotConfigured = 2,
    InvalidThreshold = 3,
    InvalidDeadline = 4,
    InvalidReward = 5,
    TaskExists = 6,
    TaskNotFound = 7,
    FundingMismatch = 8,
    InvalidState = 9,
    DeadlinePassed = 10,
    DeadlineNotReached = 11,
    InvalidContributors = 12,
    DuplicateContributor = 13,
    InvalidResultHash = 14,
    VaultFailure = 15,
    DeadlineTooFar = 16,
}

#[contractevent]
pub struct TaskRegistered {
    #[topic]
    pub task_id: BytesN<32>,
    #[topic]
    pub maintainer: Address,
    pub threshold: u32,
    pub deadline: u64,
    pub reward_amount: i128,
}

#[contractevent]
pub struct TaskFunded {
    #[topic]
    pub task_id: BytesN<32>,
    pub reward_amount: i128,
}

#[contractevent]
pub struct TaskVerified {
    #[topic]
    pub task_id: BytesN<32>,
    pub result_hash: BytesN<32>,
    pub contributor_count: u32,
}

#[contractevent]
pub struct TaskCompleted {
    #[topic]
    pub task_id: BytesN<32>,
}

#[contractevent]
pub struct TaskExpired {
    #[topic]
    pub task_id: BytesN<32>,
}

#[contract]
pub struct ReproTaskRegistry;

#[contractimpl]
impl ReproTaskRegistry {
    pub fn __constructor(env: Env, admin: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        bump_instance(&env);
    }

    pub fn set_vault(env: Env, vault: Address) -> Result<(), RegistryError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(RegistryError::NotConfigured)?;
        admin.require_auth();
        if env.storage().instance().has(&DataKey::Vault) {
            return Err(RegistryError::AlreadyConfigured);
        }
        env.storage().instance().set(&DataKey::Vault, &vault);
        bump_instance(&env);
        Ok(())
    }

    pub fn register_task(
        env: Env,
        task_id: BytesN<32>,
        maintainer: Address,
        reward_amount: i128,
        threshold: u32,
        deadline: u64,
    ) -> Result<(), RegistryError> {
        maintainer.require_auth();
        if threshold < MIN_THRESHOLD || threshold > MAX_THRESHOLD {
            return Err(RegistryError::InvalidThreshold);
        }
        if reward_amount <= 0 || reward_amount < threshold as i128 {
            return Err(RegistryError::InvalidReward);
        }
        let now = env.ledger().timestamp();
        if deadline <= now {
            return Err(RegistryError::InvalidDeadline);
        }
        if deadline - now > MAX_DEADLINE_SECONDS {
            return Err(RegistryError::DeadlineTooFar);
        }
        let key = DataKey::Task(task_id.clone());
        if env.storage().persistent().has(&key) {
            return Err(RegistryError::TaskExists);
        }

        let reward = vault_client(&env)?.get_reward(&task_id);
        if reward.maintainer != maintainer
            || reward.amount != reward_amount
            || reward.deadline != deadline
            || reward.registered
            || reward.state != VaultRewardState::Funded
        {
            return Err(RegistryError::FundingMismatch);
        }

        vault_client(&env)?.activate(&task_id);
        let task = Task {
            maintainer: maintainer.clone(),
            reward_amount,
            threshold,
            deadline,
            state: TaskState::Open,
            result_hash: None,
        };
        env.storage().persistent().set(&key, &task);
        bump_task(&env, &key);
        TaskRegistered {
            task_id: task_id.clone(),
            maintainer,
            threshold,
            deadline,
            reward_amount,
        }
        .publish(&env);
        TaskFunded {
            task_id,
            reward_amount,
        }
        .publish(&env);
        Ok(())
    }

    pub fn finalize(
        env: Env,
        task_id: BytesN<32>,
        result_hash: BytesN<32>,
        contributors: Vec<Address>,
    ) -> Result<(), RegistryError> {
        let key = DataKey::Task(task_id.clone());
        let mut task: Task = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(RegistryError::TaskNotFound)?;
        task.maintainer.require_auth();
        if task.state != TaskState::Open {
            return Err(RegistryError::InvalidState);
        }
        if env.ledger().timestamp() > task.deadline {
            return Err(RegistryError::DeadlinePassed);
        }
        let count = contributors.len();
        if count < task.threshold || count > MAX_THRESHOLD {
            return Err(RegistryError::InvalidContributors);
        }
        for i in 0..count {
            for j in (i + 1)..count {
                if contributors.get(i).unwrap() == contributors.get(j).unwrap() {
                    return Err(RegistryError::DuplicateContributor);
                }
            }
        }

        task.state = TaskState::Completed;
        task.result_hash = Some(result_hash.clone());
        env.storage().persistent().set(&key, &task);
        vault_client(&env)?.distribute(&task_id, &contributors);
        bump_task(&env, &key);
        TaskVerified {
            task_id: task_id.clone(),
            result_hash,
            contributor_count: count,
        }
        .publish(&env);
        TaskCompleted { task_id }.publish(&env);
        Ok(())
    }

    pub fn expire(env: Env, task_id: BytesN<32>) -> Result<(), RegistryError> {
        let key = DataKey::Task(task_id.clone());
        let mut task: Task = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(RegistryError::TaskNotFound)?;
        if task.state != TaskState::Open {
            return Err(RegistryError::InvalidState);
        }
        if env.ledger().timestamp() <= task.deadline {
            return Err(RegistryError::DeadlineNotReached);
        }
        task.state = TaskState::Expired;
        env.storage().persistent().set(&key, &task);
        vault_client(&env)?.refund(&task_id);
        bump_task(&env, &key);
        TaskExpired { task_id }.publish(&env);
        Ok(())
    }

    pub fn get_task(env: Env, task_id: BytesN<32>) -> Result<Task, RegistryError> {
        let key = DataKey::Task(task_id);
        let task = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(RegistryError::TaskNotFound)?;
        bump_task(&env, &key);
        Ok(task)
    }
}

fn vault_client(env: &Env) -> Result<RewardVaultClient<'_>, RegistryError> {
    let vault = env
        .storage()
        .instance()
        .get(&DataKey::Vault)
        .ok_or(RegistryError::NotConfigured)?;
    bump_instance(env);
    Ok(RewardVaultClient::new(env, &vault))
}

fn bump_instance(env: &Env) {
    env.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);
}

fn bump_task(env: &Env, key: &DataKey) {
    env.storage()
        .persistent()
        .extend_ttl(key, BUMP_THRESHOLD, BUMP_TO);
}

#[cfg(test)]
mod test;
