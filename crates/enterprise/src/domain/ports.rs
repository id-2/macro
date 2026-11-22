use super::{DisableMemberReport, Result, RuntimePresetAllowlist, VerifiedRoxIdentity};
use crate::audit::{AuditRecord, AuditResult};
use entity_access::domain::models::{AdminTeamRole, EntityAccessReceipt};
use rox_user_id::user_id::RoxUserIdStr;
use uuid::Uuid;

/// Boxed enterprise use-case result used by object-erased admission ports.
pub type EnterpriseFuture<'a, T> = std::pin::Pin<Box<dyn Future<Output = Result<T>> + Send + 'a>>;

/// Verified identity exchange. Production has no broker implementation and returns a typed gap.
pub trait IdentityBroker: Clone + Send + Sync + 'static {
    /// Exchange broker-owned proof for verified identity facts.
    fn exchange(&self) -> impl Future<Output = Result<VerifiedRoxIdentity>> + Send;
}

/// Persistence required by enterprise use cases.
pub trait EnterpriseRepository: Clone + Send + Sync + 'static {
    /// Insert or repeat the same verified binding.
    fn bind_verified(
        &self,
        macro_user_id: &RoxUserIdStr<'_>,
        identity: VerifiedRoxIdentity,
    ) -> impl Future<Output = Result<()>> + Send;

    /// Commit lifecycle state and its audit row atomically.
    fn commit_member_state(
        &self,
        actor: &RoxUserIdStr<'_>,
        member: &RoxUserIdStr<'_>,
        disabled: bool,
        result: AuditResult,
    ) -> impl Future<Output = Result<()>> + Send;

    /// Whether new email initialization and agent sessions are refused.
    fn member_disabled(
        &self,
        member: &RoxUserIdStr<'_>,
    ) -> impl Future<Output = Result<bool>> + Send;

    /// Replace or clear a team's exhaustive runtime allowlist.
    fn set_runtime_allowlist(
        &self,
        team_id: Uuid,
        allowlist: Option<&RuntimePresetAllowlist>,
    ) -> impl Future<Output = Result<()>> + Send;

    /// Read a team's allowlist. `None` preserves existing runtime behavior.
    fn runtime_allowlist(
        &self,
        team_id: Uuid,
    ) -> impl Future<Output = Result<Option<RuntimePresetAllowlist>>> + Send;

    /// Commit a standalone audit action such as a completed login.
    fn record(&self, record: AuditRecord) -> impl Future<Output = Result<()>> + Send;
}

/// Team membership facts only. Deliberately no enterprise billing-flag read.
pub trait TeamDirectory: Clone + Send + Sync + 'static {
    /// Teams the user belongs to, in the owning repository's order.
    fn team_ids(
        &self,
        user: RoxUserIdStr<'static>,
    ) -> impl Future<Output = Result<Vec<Uuid>>> + Send;
}

/// Lookup of the external identity used by the soft lifecycle calls.
pub trait MemberDirectory: Clone + Send + Sync + 'static {
    /// Resolve a stored Rox user to FusionAuth's UUID.
    fn fusion_user_id(
        &self,
        user: &RoxUserIdStr<'_>,
    ) -> impl Future<Output = Result<String>> + Send;
}

/// Soft FusionAuth lifecycle operations. There is intentionally no hard-delete method.
pub trait UserLifecycle: Clone + Send + Sync + 'static {
    /// `DELETE /api/user/{id}` without `hardDelete`.
    fn deactivate_user(&self, fusion_user_id: &str) -> impl Future<Output = Result<()>> + Send;
    /// `PUT /api/user/{id}?reactivate=true`.
    fn reactivate_user(&self, fusion_user_id: &str) -> impl Future<Output = Result<()>> + Send;
}

/// Revokes server-side harness registrations. The member's laptop file remains unreachable.
pub trait HarnessRevoker: Clone + Send + Sync + 'static {
    /// Revoke every server record owned by this member and return the count.
    fn revoke_server_records(
        &self,
        member: &RoxUserIdStr<'_>,
    ) -> impl Future<Output = Result<usize>> + Send;
}

/// Agent-session admission supplied to the session domain.
pub trait AgentSessionAdmission: Send + Sync + 'static {
    /// Refuse disabled members and presets outside an exhaustive team list.
    fn ensure_allowed<'a>(
        &'a self,
        user: RoxUserIdStr<'static>,
        preset_id: &'a str,
    ) -> EnterpriseFuture<'a, ()>;
}

/// Email initialization's member-active gate.
pub trait MemberAccess: Send + Sync + 'static {
    /// Fail with [`super::EnterpriseError::MemberDisabled`] after an admin disable.
    fn ensure_active<'a>(&'a self, user: &'a RoxUserIdStr<'_>) -> EnterpriseFuture<'a, ()>;
}

/// Team-admin use cases consumed by the HTTP adapter.
pub trait EnterpriseAdminService: Send + Sync + 'static {
    /// Soft-disable a team member and report external capability gaps.
    fn disable_member(
        &self,
        receipt: EntityAccessReceipt<AdminTeamRole>,
        member: RoxUserIdStr<'static>,
    ) -> impl Future<Output = Result<DisableMemberReport>> + Send;

    /// Reactivate a team member without deleting or recreating any user data.
    fn enable_member(
        &self,
        receipt: EntityAccessReceipt<AdminTeamRole>,
        member: RoxUserIdStr<'static>,
    ) -> impl Future<Output = Result<()>> + Send;

    /// Write an exhaustive local-runtime allowlist.
    fn set_runtime_allowlist(
        &self,
        receipt: EntityAccessReceipt<AdminTeamRole>,
        allowlist: RuntimePresetAllowlist,
    ) -> impl Future<Output = Result<RuntimePresetAllowlist>> + Send;

    /// Remove the allowlist row, restoring unrestricted existing behavior.
    fn clear_runtime_allowlist(
        &self,
        receipt: EntityAccessReceipt<AdminTeamRole>,
    ) -> impl Future<Output = Result<()>> + Send;
}
