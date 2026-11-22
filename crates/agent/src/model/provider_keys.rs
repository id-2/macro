//! Which providers this deployment can really call.
//!
//! A provider whose deployment key is a placeholder - empty, absent, or shaped
//! unlike any key the provider mints - is configured but unreachable: every
//! model on it fails with an authentication error. The model catalog and the
//! small internal calls beside it ask here first, so they offer what answers
//! rather than what a template named.
//!
//! A provider this table says nothing about is callable as before: silence
//! means "not known to be a placeholder", never a refusal. With real keys
//! everywhere the table changes nothing.

/// A provider's deployment key: the variables it may live in, and the slots
/// the provider mints keys from.
struct DeploymentKey {
    /// The provider segment of a routed model id.
    provider: &'static str,
    /// The environment variables the key may be set in, first present wins.
    envs: &'static [&'static str],
    /// The prefixes a key the provider minted starts with.
    prefixes: &'static [&'static str],
}

/// The providers the model catalog routes to, and the shape of their real
/// keys: Anthropic `sk-ant-`, OpenAI `sk-`, Google `AIza`, Groq `gsk_`,
/// Cerebras `csk-`, and Fireworks `fw_`.
const DEPLOYMENT_KEYS: &[DeploymentKey] = &[
    DeploymentKey {
        provider: "anthropic",
        envs: &["ANTHROPIC_API_KEY"],
        prefixes: &["sk-ant-"],
    },
    DeploymentKey {
        provider: "openai",
        envs: &["OPENAI_API_KEY"],
        prefixes: &["sk-"],
    },
    DeploymentKey {
        provider: "google",
        envs: &["GOOGLE_GENERATIVE_AI_API_KEY"],
        prefixes: &["AIza"],
    },
    DeploymentKey {
        provider: "groq",
        envs: &["GROQ_API_KEY"],
        prefixes: &["gsk_"],
    },
    DeploymentKey {
        provider: "cerebras",
        envs: &["CEREBRAS_API_KEY"],
        prefixes: &["csk-"],
    },
    DeploymentKey {
        // Doppler's name, and the plural spelling some deployments use.
        provider: "fireworks",
        envs: &["FIREWORK_API_KEY", "FIREWORKS_API_KEY"],
        prefixes: &["fw_"],
    },
];

/// Models the small internal calls run on - session names, the opening line -
/// best first. `groq/gpt-oss-120b` is Rox's product default: fast, cheap, and
/// offered wherever the product runs.
const FAST_MODELS: &[&str] = &[
    "groq/gpt-oss-120b",
    "openai/gpt-5-mini",
    "anthropic/claude-haiku-4-5",
    "google/gemini-3.8-flash",
];

/// The provider segment of a routed `provider/model` id, or `None` for an id
/// the router resolves without one.
#[must_use]
fn provider_of(model: &str) -> Option<&str> {
    model.split_once('/').map(|(provider, _)| provider)
}

impl DeploymentKey {
    /// The key itself, whichever of `envs` holds it.
    fn value(&self) -> Option<String> {
        self.envs
            .iter()
            .find_map(|env| rox_env_var::optional_read_env_var(env).ok().flatten())
    }

    /// Whether the key was filled in with something the provider minted,
    /// rather than left as the deployment's placeholder.
    fn is_real(&self) -> bool {
        self.value().is_some_and(|key| {
            let key = key.trim();
            !key.is_empty() && self.prefixes.iter().any(|prefix| key.starts_with(prefix))
        })
    }
}

/// The table entry for `provider`, if this deployment knows its key shape.
#[must_use]
fn deployment_key(provider: &str) -> Option<&'static DeploymentKey> {
    DEPLOYMENT_KEYS
        .iter()
        .find(|key| key.provider == provider)
}

/// Whether `provider` can be called: its table entry's key is real, or this
/// deployment has no entry for it.
#[must_use]
pub fn provider_is_callable(provider: &str) -> bool {
    deployment_key(provider).is_none_or(DeploymentKey::is_real)
}

/// Whether a turn on `model` can reach its provider. Ids without a provider
/// segment are left to the router.
#[must_use]
pub fn model_is_callable(model: &str) -> bool {
    provider_of(model).is_none_or(provider_is_callable)
}

/// The model the small internal calls run on: the first of [`FAST_MODELS`]
/// this deployment can call, else its best-known entry.
#[must_use]
pub fn fast_model() -> &'static str {
    FAST_MODELS
        .iter()
        .copied()
        .find(|model| model_is_callable(model))
        .unwrap_or(FAST_MODELS[0])
}
