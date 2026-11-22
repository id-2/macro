use std::{
    collections::HashSet,
    sync::{Arc, Mutex},
};

use bot_id::BotId;
use rox_user_id::user_id::RoxUserIdStr;
use model_user::UserContext;
use rootcause::Report;
use uuid::Uuid;

use super::RoxAuthorizationServiceImpl;
use crate::domain::{
    models::{
        AuthorizedUserApiKey, BotActingUserClaims, BotAuthentication, BotScope, CredentialOrigin,
        InternalAuthConfig, InternalIdentityClaims, RoxAuthorizationError,
        RoxUserAuthentication, ValidatedCredential, ValidatedIdentity,
    },
    ports::{
        BotAuthorizer, JwtValidator, RoxAuthorizationService, NoBotAuthorizer,
        NoUserApiKeyAuthorizer, UserApiKeyAuthorizer,
    },
};

#[derive(Clone)]
struct FakeJwtValidator {
    result: Result<ValidatedCredential, RoxAuthorizationError>,
}

impl JwtValidator for FakeJwtValidator {
    fn validate_credential(
        &self,
        _jwt: &str,
    ) -> Result<ValidatedCredential, Report<RoxAuthorizationError>> {
        self.result.clone().map_err(Report::new)
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct BotAuthorizationCall {
    bot_token: String,
    bot_scope: BotScope,
    acting_user: Option<BotActingUserClaims>,
}

#[derive(Clone)]
struct FakeBotAuthorizer {
    calls: Arc<Mutex<Vec<BotAuthorizationCall>>>,
    result: Result<BotAuthentication, RoxAuthorizationError>,
}

impl FakeBotAuthorizer {
    fn new(result: Result<BotAuthentication, RoxAuthorizationError>) -> Self {
        Self {
            calls: Arc::new(Mutex::new(Vec::new())),
            result,
        }
    }

    fn calls(&self) -> Vec<BotAuthorizationCall> {
        self.calls.lock().expect("calls lock poisoned").clone()
    }
}

#[derive(Clone)]
struct FakeUserApiKeyAuthorizer {
    calls: Arc<Mutex<Vec<String>>>,
    result: Result<UserContext, RoxAuthorizationError>,
}

impl FakeUserApiKeyAuthorizer {
    fn new(result: Result<UserContext, RoxAuthorizationError>) -> Self {
        Self {
            calls: Arc::new(Mutex::new(Vec::new())),
            result,
        }
    }

    fn calls(&self) -> Vec<String> {
        self.calls.lock().expect("calls lock poisoned").clone()
    }
}

impl UserApiKeyAuthorizer for FakeUserApiKeyAuthorizer {
    async fn authorize_user_api_key(
        &self,
        api_key: &str,
    ) -> Result<AuthorizedUserApiKey, Report<RoxAuthorizationError>> {
        self.calls
            .lock()
            .expect("calls lock poisoned")
            .push(api_key.to_string());

        self.result
            .clone()
            .map(|user_context| AuthorizedUserApiKey {
                user_context,
                account_manager: None,
            })
            .map_err(Report::new)
    }
}

impl BotAuthorizer for FakeBotAuthorizer {
    async fn authorize_bot(
        &self,
        bot_token: &str,
        bot_scope: BotScope,
        acting_user: Option<BotActingUserClaims>,
    ) -> Result<BotAuthentication, Report<RoxAuthorizationError>> {
        self.calls
            .lock()
            .expect("calls lock poisoned")
            .push(BotAuthorizationCall {
                bot_token: bot_token.to_string(),
                bot_scope,
                acting_user,
            });

        self.result.clone().map_err(Report::new)
    }
}

#[derive(Clone)]
struct DefaultRejectingAuthorizationService;

impl RoxAuthorizationService for DefaultRejectingAuthorizationService {
    async fn authorize(&self, _jwt: &str) -> Result<UserContext, Report<RoxAuthorizationError>> {
        Err(Report::new(RoxAuthorizationError::InvalidCredentials))
    }

    async fn authorize_identity(
        &self,
        jwt: &str,
    ) -> Result<ValidatedCredential, Report<RoxAuthorizationError>> {
        self.authorize(jwt)
            .await
            .map(crate::ValidatedCredential::session)
    }

    async fn authorize_internal(
        &self,
        _provided_key: &str,
        _claims: InternalIdentityClaims,
    ) -> Result<Option<UserContext>, Report<RoxAuthorizationError>> {
        Err(Report::new(RoxAuthorizationError::InvalidCredentials))
    }
}

const INTERNAL_API_KEY: &str = "secret-key";
const BOT_ID: BotId = BotId::new_from_uuid(Uuid::from_u128(1));
const TOKEN_ID: Uuid = Uuid::from_u128(2);
const TEAM_ID: Uuid = Uuid::from_u128(3);

fn internal_auth_config(default_user_id: Option<&str>) -> InternalAuthConfig {
    InternalAuthConfig {
        api_key: INTERNAL_API_KEY.to_string(),
        default_user_id: default_user_id.map(str::to_string),
    }
}

fn service_with_internal_auth(
    default_user_id: Option<&str>,
) -> RoxAuthorizationServiceImpl<FakeJwtValidator> {
    RoxAuthorizationServiceImpl::new(
        FakeJwtValidator {
            result: Err(RoxAuthorizationError::InvalidCredentials),
        },
        internal_auth_config(default_user_id),
        NoBotAuthorizer,
        NoUserApiKeyAuthorizer,
    )
}

fn bot_authentication() -> BotAuthentication {
    BotAuthentication {
        bot_id: BOT_ID,
        token_id: TOKEN_ID,
        bot_scope: BotScope::Team,
        team_id: Some(TEAM_ID),
        acting_user: Some(RoxUserAuthentication {
            origin: crate::CredentialOrigin::Bot,
            agent_id: None,
            agent_via: None,
            rox_user_id: RoxUserIdStr::try_from("rox|acting@example.com".to_string())
                .expect("valid Rox user id"),
            user_context: UserContext {
                user_id: "rox|acting@example.com".to_string(),
                fusion_user_id: "fusion-acting-user".to_string(),
                permissions: None,
                organization_id: Some(42),
            },
        }),
    }
}

fn assert_bot_authentication(bot: &BotAuthentication) {
    assert_eq!(bot.bot_id, BOT_ID);
    assert_eq!(bot.token_id, TOKEN_ID);
    assert_eq!(bot.bot_scope, BotScope::Team);
    assert_eq!(bot.team_id, Some(TEAM_ID));

    let acting_user = bot
        .acting_user
        .as_ref()
        .expect("expected a verified acting user");
    assert_eq!(
        acting_user.rox_user_id.as_ref(),
        "rox|acting@example.com"
    );
    assert_eq!(acting_user.user_context.user_id, "rox|acting@example.com");
    assert_eq!(
        acting_user.user_context.fusion_user_id,
        "fusion-acting-user"
    );
    assert_eq!(acting_user.user_context.organization_id, Some(42));
    assert_eq!(acting_user.user_context.permissions, None);
}

#[tokio::test]
async fn no_bot_authorizer_rejects_bot_credentials() {
    let error = NoBotAuthorizer
        .authorize_bot(
            "bot-token",
            BotScope::User,
            Some(BotActingUserClaims {
                user_id: Some("rox|acting@example.com".to_string()),
                fusion_user_id: None,
                organization_id: None,
            }),
        )
        .await
        .unwrap_err();

    assert_eq!(
        error.current_context(),
        &RoxAuthorizationError::InvalidCredentials
    );
}

#[tokio::test]
async fn authorization_service_trait_rejects_bots_by_default() {
    let error = DefaultRejectingAuthorizationService
        .authorize_bot("bot-token", BotScope::User, None)
        .await
        .unwrap_err();

    assert_eq!(
        error.current_context(),
        &RoxAuthorizationError::InvalidCredentials
    );
}

#[tokio::test]
async fn authorization_service_impl_rejects_bots_with_explicit_no_bot_authorizer() {
    let error = service_with_internal_auth(None)
        .authorize_bot("bot-token", BotScope::User, None)
        .await
        .unwrap_err();

    assert_eq!(
        error.current_context(),
        &RoxAuthorizationError::InvalidCredentials
    );
}

#[tokio::test]
async fn authorize_bot_delegates_token_and_exact_acting_user_claims() {
    let claims = BotActingUserClaims {
        user_id: Some("rox|acting@example.com".to_string()),
        fusion_user_id: Some("fusion-acting-user".to_string()),
        organization_id: Some(42),
    };
    let authorizer = FakeBotAuthorizer::new(Ok(bot_authentication()));
    let service = RoxAuthorizationServiceImpl::new(
        FakeJwtValidator {
            result: Err(RoxAuthorizationError::InvalidCredentials),
        },
        internal_auth_config(None),
        authorizer.clone(),
        NoUserApiKeyAuthorizer,
    );

    let bot = service
        .authorize_bot("bot-token", BotScope::Team, Some(claims.clone()))
        .await
        .unwrap();

    assert_bot_authentication(&bot);
    assert_eq!(
        authorizer.calls(),
        vec![BotAuthorizationCall {
            bot_token: "bot-token".to_string(),
            bot_scope: BotScope::Team,
            acting_user: Some(claims),
        }]
    );
}

#[tokio::test]
async fn authorize_bot_passes_through_authorizer_errors() {
    for expected in [
        RoxAuthorizationError::InvalidCredentials,
        RoxAuthorizationError::ActingUserNotAuthorized,
        RoxAuthorizationError::BotScopeNotAuthorized,
        RoxAuthorizationError::Unavailable,
    ] {
        let service = RoxAuthorizationServiceImpl::new(
            FakeJwtValidator {
                result: Err(RoxAuthorizationError::InvalidCredentials),
            },
            internal_auth_config(None),
            FakeBotAuthorizer::new(Err(expected)),
            NoUserApiKeyAuthorizer,
        );

        let error = service
            .authorize_bot("bot-token", BotScope::User, None)
            .await
            .unwrap_err();

        assert_eq!(error.current_context(), &expected);
    }
}

#[tokio::test]
async fn authorize_constructs_user_context_from_validated_identity() {
    let permissions = HashSet::from(["documents:read".to_string(), "documents:write".to_string()]);
    let service = RoxAuthorizationServiceImpl::new(
        FakeJwtValidator {
            result: Ok(ValidatedCredential {
                origin: CredentialOrigin::Session,
                identity: ValidatedIdentity {
                    agent_id: None,
                    agent_via: None,
                    user_id: "rox|user@example.com".to_string(),
                    fusion_user_id: "fusion-user-id".to_string(),
                    organization_id: Some(42),
                    permissions: Some(permissions.clone()),
                },
            }),
        },
        internal_auth_config(None),
        NoBotAuthorizer,
        NoUserApiKeyAuthorizer,
    );

    let context = service.authorize("valid-jwt").await.unwrap();

    assert_eq!(context.user_id, "rox|user@example.com");
    assert_eq!(context.fusion_user_id, "fusion-user-id");
    assert_eq!(context.organization_id, Some(42));
    assert_eq!(context.permissions, Some(permissions));
}

#[tokio::test]
async fn authorize_internal_rejects_an_incorrect_key() {
    let service = service_with_internal_auth(None);

    let error = service
        .authorize_internal("secret-kex", InternalIdentityClaims::default())
        .await
        .unwrap_err();

    assert_eq!(
        error.current_context(),
        &RoxAuthorizationError::InvalidCredentials
    );
}

#[tokio::test]
async fn authorize_internal_maps_explicit_identity_claims() {
    let service = service_with_internal_auth(Some("rox|default@example.com"));

    let context = service
        .authorize_internal(
            INTERNAL_API_KEY,
            InternalIdentityClaims {
                user_id: Some("rox|acting@example.com".to_string()),
                fusion_user_id: Some("fusion-user-id".to_string()),
                organization_id: Some(42),
            },
        )
        .await
        .unwrap()
        .expect("explicit user claim should establish an identity");

    assert_eq!(context.user_id, "rox|acting@example.com");
    assert_eq!(context.fusion_user_id, "fusion-user-id");
    assert_eq!(context.organization_id, Some(42));
    assert_eq!(context.permissions, None);
}

#[tokio::test]
async fn authorize_internal_uses_the_configured_default_user() {
    let service = service_with_internal_auth(Some("rox|default@example.com"));

    let context = service
        .authorize_internal(INTERNAL_API_KEY, InternalIdentityClaims::default())
        .await
        .unwrap()
        .expect("configured default user should establish an identity");

    assert_eq!(context.user_id, "rox|default@example.com");
    assert_eq!(context.fusion_user_id, "");
    assert_eq!(context.organization_id, None);
    assert_eq!(context.permissions, None);
}

#[tokio::test]
async fn authorize_internal_returns_none_without_an_identity() {
    let service = service_with_internal_auth(None);

    let context = service
        .authorize_internal(INTERNAL_API_KEY, InternalIdentityClaims::default())
        .await
        .unwrap();

    assert!(context.is_none());
}

#[tokio::test]
async fn authorize_propagates_expired_credentials() {
    let service = RoxAuthorizationServiceImpl::new(
        FakeJwtValidator {
            result: Err(RoxAuthorizationError::CredentialsExpired),
        },
        internal_auth_config(None),
        NoBotAuthorizer,
        NoUserApiKeyAuthorizer,
    );

    let error = service.authorize("expired-jwt").await.unwrap_err();

    assert_eq!(
        error.current_context(),
        &RoxAuthorizationError::CredentialsExpired
    );
}

#[tokio::test]
async fn authorize_propagates_invalid_credentials() {
    let service = RoxAuthorizationServiceImpl::new(
        FakeJwtValidator {
            result: Err(RoxAuthorizationError::InvalidCredentials),
        },
        internal_auth_config(None),
        NoBotAuthorizer,
        NoUserApiKeyAuthorizer,
    );

    let error = service.authorize("invalid-jwt").await.unwrap_err();

    assert_eq!(
        error.current_context(),
        &RoxAuthorizationError::InvalidCredentials
    );
}

#[tokio::test]
async fn no_user_api_key_authorizer_rejects_user_api_keys() {
    let error = NoUserApiKeyAuthorizer
        .authorize_user_api_key("mak_secret")
        .await
        .unwrap_err();

    assert_eq!(
        error.current_context(),
        &RoxAuthorizationError::InvalidCredentials
    );
}

#[tokio::test]
async fn authorization_service_trait_rejects_user_api_keys_by_default() {
    let error = DefaultRejectingAuthorizationService
        .authorize_user_api_key("mak_secret")
        .await
        .unwrap_err();

    assert_eq!(
        error.current_context(),
        &RoxAuthorizationError::InvalidCredentials
    );
}

#[tokio::test]
async fn authorization_service_impl_rejects_user_api_keys_with_explicit_no_authorizer() {
    let error = service_with_internal_auth(None)
        .authorize_user_api_key("mak_secret")
        .await
        .unwrap_err();

    assert_eq!(
        error.current_context(),
        &RoxAuthorizationError::InvalidCredentials
    );
}

fn api_key_user_context() -> UserContext {
    UserContext {
        user_id: "rox|api-key@example.com".to_string(),
        fusion_user_id: "fusion-api-key-user".to_string(),
        permissions: None,
        organization_id: Some(42),
    }
}

#[tokio::test]
async fn authorize_user_api_key_delegates_the_exact_key() {
    let authorizer = FakeUserApiKeyAuthorizer::new(Ok(api_key_user_context()));
    let service = RoxAuthorizationServiceImpl::new(
        FakeJwtValidator {
            result: Err(RoxAuthorizationError::InvalidCredentials),
        },
        internal_auth_config(None),
        NoBotAuthorizer,
        authorizer.clone(),
    );

    let authorized = service.authorize_user_api_key("mak_secret").await.unwrap();
    let context = authorized.user_context;

    assert_eq!(context.user_id, "rox|api-key@example.com");
    assert_eq!(context.fusion_user_id, "fusion-api-key-user");
    assert_eq!(context.organization_id, Some(42));
    assert_eq!(context.permissions, None);
    assert_eq!(authorizer.calls(), vec!["mak_secret".to_string()]);
}

#[tokio::test]
async fn authorize_user_api_key_passes_through_authorizer_errors() {
    for expected in [
        RoxAuthorizationError::InvalidCredentials,
        RoxAuthorizationError::Unavailable,
    ] {
        let service = RoxAuthorizationServiceImpl::new(
            FakeJwtValidator {
                result: Err(RoxAuthorizationError::InvalidCredentials),
            },
            internal_auth_config(None),
            NoBotAuthorizer,
            FakeUserApiKeyAuthorizer::new(Err(expected)),
        );

        let error = service
            .authorize_user_api_key("mak_secret")
            .await
            .unwrap_err();

        assert_eq!(error.current_context(), &expected);
    }
}

#[tokio::test]
async fn authorize_identity_keeps_verified_agent_and_owner() {
    let service = RoxAuthorizationServiceImpl::new(
        FakeJwtValidator {
            result: Ok(ValidatedCredential {
                origin: CredentialOrigin::RoxApiJwt,
                identity: ValidatedIdentity {
                    agent_id: Some(bot_id::ROX_NEW_BOT_ID),
                    agent_via: None,
                    user_id: "rox|owner@example.com".into(),
                    fusion_user_id: "fusion-owner".into(),
                    organization_id: Some(42),
                    permissions: None,
                },
            }),
        },
        internal_auth_config(None),
        NoBotAuthorizer,
        NoUserApiKeyAuthorizer,
    );
    let credential = service.authorize_identity("signed-token").await.unwrap();
    assert_eq!(credential.origin, CredentialOrigin::RoxApiJwt);
    let identity = credential.identity;
    assert_eq!(identity.agent_id, Some(bot_id::ROX_NEW_BOT_ID));
    assert_eq!(identity.user_id, "rox|owner@example.com");
    assert_eq!(
        service.authorize("signed-token").await.unwrap().user_id,
        identity.user_id
    );
}
