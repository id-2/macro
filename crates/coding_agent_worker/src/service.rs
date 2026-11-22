//! Headless mode for embedders: the serving core without the terminal panel.
//!
//! The Rox desktop app bundles roxd and manages it as a child process.
//! `roxd service` is the contract between them: setup flags configure
//! `roxd.toml` (the same `~/.roxd/roxd.toml` the TUI uses, or the
//! `--profile` it names, locked while serving) without a TUI, state changes
//! stream to stdout as one JSON object per line, and the process shuts down
//! on SIGTERM, Ctrl-C, or stdin closing (the embedder exited), unless
//! `--ignore-stdin-eof` is set for a system service. `roxd detect-agents`
//! and `roxd inspect`
//! are the matching one-shot queries.

use std::path::{Path, PathBuf};
use std::time::Duration;

use rootcause::prelude::ResultExt as _;
use serde::Serialize;
use tokio::io::AsyncReadExt as _;

use crate::config::{self, Config, ConfigLock, HarnessCredentials};
use crate::daemon::Daemon;
use crate::outbound::pairing::{ClaimStatus, PairingClient, machine_name};
use crate::profiles::{ConfigSelection, ProfileName};
use crate::tui::agent_catalog::{self, DetectedAgent, PathCommands};
use crate::tui::config_form::{ConfigForm, Setting};

#[cfg(test)]
mod test;

/// How often the serving core's liveness is re-checked once running.
const DAEMON_WATCH: Duration = Duration::from_secs(5);

/// Where the embedding app's own session lives, when it differs from the
/// config file's deployment. Every field is optional; a plain restart of an
/// already configured daemon passes none of them.
#[derive(Debug, Clone, Default)]
pub struct DeploymentUrls {
    /// Base URL of the agent-harness service.
    pub api: Option<String>,
    /// Base URL of the storage service.
    pub storage: Option<String>,
    /// Base URL of the web app.
    pub web: Option<String>,
}

impl DeploymentUrls {
    /// Whether any URL was given.
    fn any(&self) -> bool {
        self.api.is_some() || self.storage.is_some() || self.web.is_some()
    }

    /// The values that pass validation: absolute http(s) URLs.
    fn valid(&self) -> rootcause::Result<DeploymentUrls> {
        let check = |name: &str, url: &Option<String>| -> rootcause::Result<Option<String>> {
            match url {
                None => Ok(None),
                Some(url) => {
                    let url = url.trim();
                    if url.starts_with("http://") || url.starts_with("https://") {
                        Ok(Some(url.trim_end_matches('/').to_owned()))
                    } else {
                        rootcause::bail!("{name} must be an http or https URL, got `{url}`")
                    }
                }
            }
        };
        Ok(DeploymentUrls {
            api: check("api_url", &self.api)?,
            storage: check("storage_url", &self.storage)?,
            web: check("web_url", &self.web)?,
        })
    }
}

/// Everything `roxd service` accepts. Runtime settings (name, ownership,
/// permission bypass) are set on the web, never here.
pub struct ServiceOptions {
    /// Keep running without an embedder holding stdin open.
    pub ignore_stdin_eof: bool,
    /// Config file; absent uses `profile`, or else the default config the
    /// TUI also uses.
    pub config: Option<PathBuf>,
    /// Named profile, `~/.roxd/profiles/<name>.toml`.
    pub profile: Option<ProfileName>,
    /// Agent preset id from `detect-agents` to configure.
    pub agent: Option<String>,
    /// Workspace directory sessions run in; created when missing.
    pub workspace: Option<PathBuf>,
    /// The embedding app's deployment, overriding the config file.
    pub deployment: DeploymentUrls,
    /// The signed-in user's Rox API token, when the embedder has one. The
    /// daemon approves its own pairing code with it instead of waiting for
    /// the app's web page to confirm the code.
    pub approval_token: Option<String>,
}

impl ServiceOptions {
    /// Whether any setup flag was passed, i.e. the config should be (re)written.
    fn wants_setup(&self) -> bool {
        self.agent.is_some() || self.workspace.is_some() || self.deployment.any()
    }
}

/// One state change, written to stdout as a single JSON line.
#[derive(Debug, Serialize)]
#[serde(tag = "event", rename_all = "snake_case")]
enum Event {
    /// The config loaded; emitted once at startup and after a setup rewrite.
    Config {
        path: String,
        agent_id: Option<&'static str>,
        agent_name: Option<&'static str>,
        workspace: String,
        paired: bool,
        web_url: String,
    },
    /// A chosen agent's npm ACP adapter is installing.
    InstallingAdapter { package: &'static str },
    /// The adapter install finished.
    AdapterInstalled { package: &'static str },
    /// A pairing is open and waiting for web approval.
    Pairing {
        pairing_id: String,
        code: String,
        url: String,
        expires_at: chrono::DateTime<chrono::Utc>,
    },
    /// The daemon is confirming the open code with the embedder's session.
    Approving { pairing_id: String, code: String },
    /// That confirmation failed; the code stays open for the web approval.
    ApprovalFailed { code: String, message: String },
    /// The pairing was approved and the credential persisted.
    Paired { harness_id: String },
    /// The serving core is up on the stored credential.
    Running { harness_id: String },
    /// The service is exiting on an error; the message is user-facing.
    Fatal { message: String },
}

fn emit(event: &Event) {
    use std::io::Write as _;

    let line = serde_json::to_string(event).expect("service events are plain data");
    let mut stdout = std::io::stdout().lock();
    let _ = writeln!(stdout, "{line}");
    let _ = stdout.flush();
}

/// Report a fatal error as the last event before a non-zero exit.
pub fn emit_fatal(message: &str) {
    emit(&Event::Fatal {
        message: fatal_root_message(message),
    });
}

/// Reports render as decorated multi-line trees; an embedder shows one plain
/// sentence, so keep the root message alone.
fn fatal_root_message(message: &str) -> String {
    message
        .lines()
        .map(|line| line.trim().trim_start_matches('●').trim())
        .find(|line| !line.is_empty() && !line.starts_with('╰'))
        .unwrap_or(message)
        .to_owned()
}

/// Run headless until signaled or the monitored stdin closes.
pub async fn run(options: ServiceOptions) -> rootcause::Result<()> {
    let selection = ConfigSelection::resolve(options.config.clone(), options.profile.clone())?;
    let path = selection.path.clone();
    // Held until exit: the TUI shares this config, and one harness must not
    // be served twice.
    let _lock: ConfigLock = config::lock(&path)?;
    let shutdown = shutdown_requested(options.ignore_stdin_eof);
    tokio::pin!(shutdown);

    let daemon = tokio::select! {
        daemon = start(&selection, &options) => daemon?,
        () = &mut shutdown => return Ok(()),
    };

    loop {
        tokio::select! {
            () = &mut shutdown => break,
            () = tokio::time::sleep(DAEMON_WATCH) => {
                if !daemon.is_running() {
                    daemon.stop().await;
                    rootcause::bail!("the serving core stopped unexpectedly");
                }
            }
        }
    }
    daemon.stop().await;
    Ok(())
}

/// Configure, install, pair, and start the serving core.
async fn start(selection: &ConfigSelection, options: &ServiceOptions) -> rootcause::Result<Daemon> {
    let path = selection.path.as_path();
    if !path.exists() && !options.wants_setup() {
        rootcause::bail!(
            "no config at {}; pass --agent and --workspace to create one",
            path.display()
        );
    }
    if options.wants_setup() {
        let agent = options.agent.as_deref().map(installed_agent).transpose()?;
        let deployment = options.deployment.valid()?;
        configure(path, options, agent, &deployment)?;
    }

    let config = Config::load(path)?;
    let commands = PathCommands::discover();
    let agent = agent_catalog::detected_for(&config.harness, &commands);
    emit(&Event::Config {
        path: path.display().to_string(),
        agent_id: agent.as_ref().map(|agent| agent.kind.id()),
        agent_name: agent.as_ref().map(|agent| agent.name),
        workspace: config.workspace.path.display().to_string(),
        paired: config
            .credentials
            .as_ref()
            .is_some_and(HarnessCredentials::is_valid),
        web_url: config.macro_api.web_url.clone(),
    });

    if let Some(install) = agent.as_ref().and_then(DetectedAgent::pending_install) {
        emit(&Event::InstallingAdapter {
            package: install.package,
        });
        install
            .run()
            .await
            .map_err(|message| rootcause::report!("{message}"))?;
        emit(&Event::AdapterInstalled {
            package: install.package,
        });
    }

    let credentials = match config
        .credentials
        .clone()
        .filter(HarnessCredentials::is_valid)
    {
        Some(credentials) => credentials,
        None => pair(selection, &config, options.approval_token.as_deref()).await?,
    };
    // Pairing persisted into the file; serve what is actually on disk.
    let config = Config::load(path)?;
    let harness_id = credentials.harness_id.to_string();
    let daemon = Daemon::start(config, credentials, path, None).await?;
    emit(&Event::Running { harness_id });
    Ok(daemon)
}

/// Open one pairing and poll it to a claimed credential.
///
/// One code per invocation on purpose: an expired or consumed pairing ends the
/// process, and the embedder decides whether to start over.
async fn pair(
    selection: &ConfigSelection,
    config: &Config,
    approval_token: Option<&str>,
) -> rootcause::Result<HarnessCredentials> {
    let client = PairingClient::new(config);
    let created = client
        .start(selection.pairing_name(&machine_name()))
        .await?;
    emit(&Event::Pairing {
        pairing_id: created.pairing_id.to_string(),
        code: created.code.clone(),
        url: config.macro_api.pairing_approval_url(&created.code),
        expires_at: created.expires_at,
    });
    // The embedding app is already signed in: confirm the code with its own
    // session instead of leaving it for the web page, which may never open.
    let mut approval_error = match approval_token {
        Some(token) => {
            emit(&Event::Approving {
                pairing_id: created.pairing_id.to_string(),
                code: created.code.clone(),
            });
            match client.approve(&created.code, token).await {
                Ok(()) => None,
                Err(error) => {
                    let message = error.to_string();
                    emit(&Event::ApprovalFailed {
                        code: created.code.clone(),
                        message: message.clone(),
                    });
                    Some(message)
                }
            }
        }
        None => None,
    };
    let interval = Duration::from_secs(created.poll_interval_seconds.max(1));
    loop {
        tokio::time::sleep(interval).await;
        if created.expires_at <= chrono::Utc::now() {
            rootcause::bail!("the pairing code expired before it was approved");
        }
        // A failed confirmation is retried each poll: the credential may be
        // transiently unreachable, and the code stays valid for minutes.
        if let (Some(token), Some(_)) = (approval_token, approval_error.as_ref()) {
            match client.approve(&created.code, token).await {
                Ok(()) => approval_error = None,
                Err(error) => approval_error = Some(error.to_string()),
            }
        }
        match client
            .claim(created.pairing_id, &created.device_secret)
            .await?
        {
            ClaimStatus::Pending => {}
            ClaimStatus::Claimed(credentials) => {
                ConfigForm::load(&selection.path)?.persist_credentials(&credentials)?;
                emit(&Event::Paired {
                    harness_id: credentials.harness_id.to_string(),
                });
                return Ok(credentials);
            }
            ClaimStatus::Gone(reason) => rootcause::bail!("{reason}"),
        }
    }
}

/// Create or edit the config from setup flags, comment-preservingly.
/// `agent` is the resolved launch for `options.agent`, when one was named;
/// `deployment` is where the embedding app's own session lives.
pub(crate) fn configure(
    path: &Path,
    options: &ServiceOptions,
    agent: Option<DetectedAgent>,
    deployment: &DeploymentUrls,
) -> rootcause::Result<()> {
    if let Some(workspace) = &options.workspace {
        std::fs::create_dir_all(workspace).context(format!(
            "could not create the workspace at {}",
            workspace.display()
        ))?;
    }
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).context(format!(
            "could not create the config directory at {}",
            parent.display()
        ))?;
    }

    if !path.exists() {
        let agent = agent
            .as_ref()
            .ok_or_else(|| rootcause::report!("creating a config needs --agent"))?;
        let workspace = options
            .workspace
            .as_deref()
            .ok_or_else(|| rootcause::report!("creating a config needs --workspace"))?;
        ConfigForm::create(path, agent, workspace)?;
        let mut form = ConfigForm::load(path)?;
        apply_deployment(&mut form, deployment);
        return form.save();
    }
    let mut form = ConfigForm::load(path)?;
    form.drop_retired_settings();
    if let Some(agent) = &agent {
        form.apply_agent(agent);
    }
    if let Some(workspace) = &options.workspace {
        form.apply_text(Setting::Workspace, &workspace.to_string_lossy())
            .map_err(|message| rootcause::report!("{message}"))?;
    }
    apply_deployment(&mut form, deployment);
    form.save()
}

/// Write the deployment URLs the embedder gave, leaving the file's own
/// values for any it did not.
fn apply_deployment(form: &mut ConfigForm, deployment: &DeploymentUrls) {
    if let (Some(api), Some(storage), Some(web)) =
        (&deployment.api, &deployment.storage, &deployment.web)
    {
        form.set_deployment_urls(api, storage, web);
    }
}

pub(crate) fn installed_agent(id: &str) -> rootcause::Result<DetectedAgent> {
    let commands = PathCommands::discover();
    agent_catalog::discover(&commands)
        .into_iter()
        .find(|agent| agent.kind.id() == id)
        .ok_or_else(|| {
            rootcause::report!(
                "agent `{id}` is not installed on this machine; run `roxd detect-agents`"
            )
        })
}

/// Resolve when the embedder or operator asks the service to stop: SIGTERM,
/// Ctrl-C, or stdin reaching EOF (the embedding process exited).
async fn shutdown_requested(ignore_stdin_eof: bool) {
    let stdin_eof = stdin_closed(tokio::io::stdin(), ignore_stdin_eof);
    #[cfg(unix)]
    {
        let mut terminate =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
                .expect("installing a SIGTERM handler never fails");
        tokio::select! {
            _ = tokio::signal::ctrl_c() => {}
            _ = terminate.recv() => {}
            () = stdin_eof => {}
        }
    }
    #[cfg(not(unix))]
    tokio::select! {
        _ = tokio::signal::ctrl_c() => {}
        () = stdin_eof => {}
    }
}

async fn stdin_closed(mut stdin: impl tokio::io::AsyncRead + Unpin, ignore_eof: bool) {
    if ignore_eof {
        std::future::pending::<()>().await;
    }
    let mut buffer = [0u8; 256];
    loop {
        match stdin.read(&mut buffer).await {
            Ok(0) | Err(_) => break,
            Ok(_) => {}
        }
    }
}

/// The `detect-agents` answer: installed agents in product-preference order.
#[derive(Debug, Serialize)]
struct DetectedAgents {
    agents: Vec<DetectedAgentReport>,
}

/// One installed agent, as reported to an embedder.
#[derive(Debug, Serialize)]
struct DetectedAgentReport {
    /// Stable preset id, accepted by `service --agent`.
    id: &'static str,
    /// Human-readable name.
    name: &'static str,
    /// The command that starts this agent, resolved on this machine.
    command: String,
    /// Where the agent keeps its own settings and credentials, when it has
    /// an established location.
    config_path: Option<String>,
    /// Short explanation for adapter-backed launchers.
    note: Option<&'static str>,
    /// Whether selecting this agent still downloads an ACP adapter first.
    needs_install: bool,
}

/// The ACP agents installed on this machine, as a JSON document.
pub fn detect_agents_json() -> String {
    let commands = PathCommands::discover();
    let agents = agent_catalog::discover(&commands)
        .into_iter()
        .map(|agent| DetectedAgentReport {
            id: agent.kind.id(),
            name: agent.name,
            command: agent_catalog::launch_command(&agent, &commands),
            config_path: agent_catalog::config_dir(agent.kind)
                .map(|path| path.display().to_string()),
            note: agent.note,
            needs_install: agent.pending_install().is_some(),
        })
        .collect();
    serde_json::to_string(&DetectedAgents { agents }).expect("agent reports are plain data")
}

/// The `inspect` answer: the service config's state, without running anything.
#[derive(Debug, Serialize)]
struct Inspection {
    config_path: String,
    exists: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
    paired: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    harness_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    agent_id: Option<&'static str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    agent_name: Option<&'static str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    workspace: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    web_url: Option<String>,
}

/// Inspect the config `--config` or `--profile` names (else the default one)
/// as a JSON document.
pub fn inspect_json(
    config: Option<PathBuf>,
    profile: Option<ProfileName>,
) -> rootcause::Result<String> {
    let path = ConfigSelection::resolve(config, profile)?.path;
    let mut inspection = Inspection {
        config_path: path.display().to_string(),
        exists: path.exists(),
        error: None,
        paired: false,
        harness_id: None,
        agent_id: None,
        agent_name: None,
        workspace: None,
        web_url: None,
    };
    if inspection.exists {
        match Config::load(&path) {
            Ok(config) => {
                let commands = PathCommands::discover();
                let agent = agent_catalog::detected_for(&config.harness, &commands);
                let credentials = config
                    .credentials
                    .as_ref()
                    .filter(|credentials| credentials.is_valid());
                inspection.paired = credentials.is_some();
                inspection.harness_id =
                    credentials.map(|credentials| credentials.harness_id.to_string());
                inspection.agent_id = agent.as_ref().map(|agent| agent.kind.id());
                inspection.agent_name = agent.as_ref().map(|agent| agent.name);
                inspection.workspace = Some(config.workspace.path.display().to_string());
                inspection.web_url = Some(config.macro_api.web_url.clone());
            }
            Err(error) => inspection.error = Some(format!("{error}")),
        }
    }
    Ok(serde_json::to_string(&inspection).expect("inspections are plain data"))
}
