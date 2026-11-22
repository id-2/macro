use utoipa::ToSchema;

#[derive(serde::Serialize, serde::Deserialize, Debug, ToSchema)]
pub struct SsoRequiredResponse {
    /// The idp_id you need to perform sso login with.
    pub idp_id: String,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Default, ToSchema)]
pub struct PasswordlessStartedResponse {
    /// The one-time login code, present only when the service runs with
    /// `PASSWORDLESS_RETURN_CODE=true` (a local stack that cannot read email).
    /// A public deployment never returns it.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
}
