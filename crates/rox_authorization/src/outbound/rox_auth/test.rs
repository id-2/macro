use std::time::{SystemTime, UNIX_EPOCH};

use ::rox_auth::{
    error::RoxAuthError,
    rox_api_token::RoxApiToken,
    middleware::decode_jwt::{JwtToken, JwtValidationArgs, RoxAccessToken},
};
use jsonwebtoken::{Algorithm, EncodingKey, Header, encode};
use rootcause::Report;

use super::*;

const ROX_USER_ID: &str = "macro|user@example.com";
const FUSION_USER_ID: &str = "fusion-user-id";

fn unix_timestamp() -> usize {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time should be after the Unix epoch")
        .as_secs() as usize
}

fn access_token(
    secret: &str,
    expiration: usize,
    root_rox_id: Option<&str>,
    organization_id: Option<i32>,
) -> String {
    let claims = RoxAccessToken {
        aud: String::new(),
        exp: expiration,
        tid: "tenant-id".to_string(),
        iss: String::new(),
        email: "user@example.com".to_string(),
        fusion_user_id: FUSION_USER_ID.to_string(),
        rox_user_id: ROX_USER_ID.to_string(),
        rox_organization_id: organization_id,
        root_rox_id: root_rox_id.map(str::to_string),
    };
    let mut header = Header::new(Algorithm::HS256);
    header.kid = Some("fusionauth".to_string());

    encode(
        &header,
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .expect("test JWT should encode")
}

fn validator() -> RoxAuthJwtValidator {
    RoxAuthJwtValidator::new(JwtValidationArgs::new_testing())
}

fn rox_auth_cause(report: &Report<RoxAuthorizationError>) -> &RoxAuthError {
    report
        .iter_sub_reports()
        .find_map(|cause| cause.downcast_current_context::<RoxAuthError>())
        .expect("validation report should retain its rox_auth cause")
}

#[test]
fn validates_access_token() {
    let token = access_token("", unix_timestamp() + 3_600, None, None);

    let credential = validator().validate_credential(&token).unwrap();
    assert_eq!(credential.origin, CredentialOrigin::Session);
    let identity = credential.identity;

    assert_eq!(identity.user_id, ROX_USER_ID);
    assert_eq!(identity.fusion_user_id, FUSION_USER_ID);
    assert_eq!(identity.organization_id, None);
    assert_eq!(identity.permissions, None);
    assert_eq!(identity.agent_id, None);
}

#[test]
fn maps_expired_access_token_to_typed_error() {
    let token = access_token("", unix_timestamp() - 3_600, None, None);

    let error = validator().validate(&token).unwrap_err();

    assert_eq!(
        error.current_context(),
        &RoxAuthorizationError::CredentialsExpired
    );
    assert!(matches!(
        rox_auth_cause(&error),
        RoxAuthError::JwtExpired
    ));
}

#[test]
fn maps_malformed_token_to_invalid_credentials() {
    let error = validator().validate("not-a-jwt").unwrap_err();

    assert_eq!(
        error.current_context(),
        &RoxAuthorizationError::InvalidCredentials
    );
    assert!(matches!(
        rox_auth_cause(&error),
        RoxAuthError::Generic(_)
    ));
}

#[test]
fn maps_wrong_signature_to_invalid_credentials() {
    let token = access_token("wrong-secret", unix_timestamp() + 3_600, None, None);

    let error = validator().validate(&token).unwrap_err();

    assert_eq!(
        error.current_context(),
        &RoxAuthorizationError::InvalidCredentials
    );
    assert!(matches!(
        rox_auth_cause(&error),
        RoxAuthError::JwtValidationFailed { .. }
    ));
}

#[test]
fn maps_root_rox_id_to_fusion_identity_field() {
    let token = access_token("", unix_timestamp() + 3_600, Some("root-macro-id"), None);

    let identity = validator().validate(&token).unwrap();

    assert_eq!(identity.user_id, ROX_USER_ID);
    assert_eq!(identity.fusion_user_id, "root-macro-id");
}

#[test]
fn preserves_access_token_organization_id() {
    let token = access_token("", unix_timestamp() + 3_600, None, Some(42));

    let identity = validator().validate(&token).unwrap();

    assert_eq!(identity.organization_id, Some(42));
}

#[test]
fn maps_rox_api_token_claims() {
    let credential = identity_from_token(JwtToken::RoxApiToken(RoxApiToken {
        agent_correlation_id: None,
        agent_session_id: None,
        routine_id: None,
        agent_scope: None,
        agent_id: None,
        agent_via: None,
        exp: unix_timestamp() + 3_600,
        iss: String::new(),
        fusion_user_id: FUSION_USER_ID.to_string(),
        rox_user_id: ROX_USER_ID.to_string(),
        rox_organization_id: Some(84),
    }));

    assert_eq!(credential.origin, CredentialOrigin::RoxApiJwt);
    let identity = credential.identity;
    assert_eq!(identity.user_id, ROX_USER_ID);
    assert_eq!(identity.fusion_user_id, FUSION_USER_ID);
    assert_eq!(identity.organization_id, Some(84));
    assert_eq!(identity.permissions, None);
    assert_eq!(identity.agent_id, None);
}

#[test]
fn maps_signed_agent_without_changing_owner_identity() {
    let agent = bot_id::ROX_NEW_BOT_ID;
    let credential = identity_from_token(JwtToken::RoxApiToken(RoxApiToken {
        agent_correlation_id: None,
        agent_session_id: None,
        routine_id: None,
        agent_scope: None,
        agent_id: Some(agent.as_uuid()),
        agent_via: Some("Claude Code".into()),
        exp: unix_timestamp() + 60,
        iss: String::new(),
        fusion_user_id: FUSION_USER_ID.into(),
        rox_user_id: ROX_USER_ID.into(),
        rox_organization_id: Some(42),
    }));
    assert_eq!(credential.origin, CredentialOrigin::RoxApiJwt);
    let identity = credential.identity;
    assert_eq!(identity.agent_id, Some(agent));
    assert_eq!(identity.agent_via.as_deref(), Some("Claude Code"));
    assert_eq!(identity.user_id, ROX_USER_ID);
    assert_eq!(identity.organization_id, Some(42));
}

#[test]
fn ignores_a_client_label_without_a_signed_agent() {
    let credential = identity_from_token(JwtToken::RoxApiToken(RoxApiToken {
        agent_correlation_id: None,
        agent_session_id: None,
        routine_id: None,
        agent_scope: None,
        agent_id: None,
        agent_via: Some("Claude Code".into()),
        exp: unix_timestamp() + 60,
        iss: String::new(),
        fusion_user_id: FUSION_USER_ID.into(),
        rox_user_id: ROX_USER_ID.into(),
        rox_organization_id: None,
    }));
    assert_eq!(credential.identity.agent_id, None);
    assert_eq!(credential.identity.agent_via, None);
}

#[test]
fn a_token_that_signs_a_scope_is_a_scoped_rox_api_jwt() {
    let credential = identity_from_token(JwtToken::RoxApiToken(RoxApiToken {
        agent_correlation_id: Some(uuid::Uuid::nil()),
        agent_session_id: None,
        routine_id: None,
        agent_scope: Some("no_send".into()),
        agent_id: Some(bot_id::ROX_NEW_BOT_ID.as_uuid()),
        agent_via: None,
        exp: unix_timestamp() + 60,
        iss: String::new(),
        fusion_user_id: FUSION_USER_ID.into(),
        rox_user_id: ROX_USER_ID.into(),
        rox_organization_id: None,
    }));
    assert_eq!(credential.origin, CredentialOrigin::ScopedMacroApiJwt);
    assert_eq!(credential.identity.user_id, ROX_USER_ID);
}
