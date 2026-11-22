use super::*;
use crate::{
    BotOnly, CredentialOrigin, InternalAuthConfig, JwtValidator, RoxAuthorizationExtractor,
    RoxAuthorizationServiceImpl, NoBotAuthorizer, NoUserApiKeyAuthorizer, UserOnly,
    ValidatedCredential, ValidatedIdentity,
};
use std::sync::Arc;

#[derive(Clone)]
struct Validator;
impl JwtValidator for Validator {
    fn validate_credential(
        &self,
        jwt: &str,
    ) -> Result<ValidatedCredential, Report<RoxAuthorizationError>> {
        self.validate(jwt).map(|identity| ValidatedCredential {
            identity,
            origin: if jwt == "user" {
                CredentialOrigin::Session
            } else {
                CredentialOrigin::RoxApiJwt
            },
        })
    }

    fn validate(&self, jwt: &str) -> Result<ValidatedIdentity, Report<RoxAuthorizationError>> {
        match jwt {
            "execution" | "api" | "user" => Ok(ValidatedIdentity {
                agent_id: (jwt == "execution").then_some(bot_id::ROX_NEW_BOT_ID),
                agent_via: None,
                user_id: "rox|owner@example.com".into(),
                fusion_user_id: "fusion-owner".into(),
                organization_id: Some(42),
                permissions: None,
            }),
            _ => Err(Report::new(RoxAuthorizationError::InvalidCredentials)),
        }
    }
}

type AuthorizationService = RoxAuthorizationServiceImpl<Validator>;

#[tokio::test]
async fn bearer_agent_attribution_survives_user_policy_without_becoming_bot_authority() {
    let state = RoxAuthorizationState::new(Arc::new(RoxAuthorizationServiceImpl::new(
        Validator,
        InternalAuthConfig {
            api_key: "internal-key".into(),
            default_user_id: None,
        },
        NoBotAuthorizer,
        NoUserApiKeyAuthorizer,
    )));
    for (token, agent) in [
        ("execution", Some(bot_id::ROX_NEW_BOT_ID)),
        ("api", None),
        ("user", None),
    ] {
        let (mut parts, _) = axum::http::Request::builder()
            .header(header::AUTHORIZATION, format!("Bearer {token}"))
            .body(())
            .unwrap()
            .into_parts();
        let caller = RoxAuthorizationExtractor::<
            RoxAuthorizationServiceImpl<Validator>,
            UserOnly,
        >::from_request_parts(&mut parts, &state)
        .await
        .unwrap();
        assert_eq!(caller.authorization.agent_id, agent);
        assert_eq!(
            caller.authorization.origin,
            if token == "user" {
                CredentialOrigin::Session
            } else {
                CredentialOrigin::RoxApiJwt
            }
        );
        assert_eq!(
            caller.authorization.rox_user_id.as_ref(),
            "rox|owner@example.com"
        );
        assert_eq!(caller.authorization.user_context.organization_id, Some(42));
        assert!(
            RoxAuthorizationExtractor::<AuthorizationService, BotOnly>::from_request_parts(
                &mut parts, &state
            )
            .await
            .is_err()
        );
    }
    let (mut parts, _) = axum::http::Request::builder()
        .header(header::AUTHORIZATION, "Bearer user")
        .header(
            "x-rox-agent-id",
            bot_id::ROX_NEW_BOT_ID.as_uuid().to_string(),
        )
        .body(())
        .unwrap()
        .into_parts();
    let caller = RoxAuthorizationExtractor::<AuthorizationService, UserOnly>::from_request_parts(
        &mut parts, &state,
    )
    .await
    .unwrap();
    assert_eq!(caller.authorization.agent_id, None);
}
