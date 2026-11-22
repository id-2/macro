//! Inbound transport adapters for authorizing credentials.

/// Axum extractors backed by the authorization service.
pub mod axum;

#[allow(deprecated)]
pub use axum::{
    AccountHolderOrInternal, ActingEntity, ActingUser, ActingUserAuthorization, AnyPrincipal,
    AuthorizationPolicy, BOT_FOR_FUSIONAUTH_USER_ID_HEADER, BOT_FOR_MACRO_USER_ID_HEADER,
    BOT_FOR_ORGANIZATION_ID_HEADER, BOT_SCOPE_HEADER, BOT_TOKEN_HEADER, BotOnly,
    CODE_EXECUTION_HEADER, HARNESS_FOR_MACRO_USER_ID_HEADER, HARNESS_TOKEN_HEADER, HarnessOnly,
    INTERNAL_API_KEY_HEADER, INTERNAL_FUSIONAUTH_USER_ID_HEADER,
    INTERNAL_MACRO_ORGANIZATION_ID_HEADER, INTERNAL_MACRO_USER_ID_HEADER, InternalAuthorization,
    InternalEntity, InternalOnly, LEGACY_BOT_FOR_FUSIONAUTH_USER_ID_HEADER,
    LEGACY_BOT_FOR_MACRO_USER_ID_HEADER,
    LEGACY_BOT_FOR_ORGANIZATION_ID_HEADER, LEGACY_BOT_SCOPE_HEADER, LEGACY_BOT_TOKEN_HEADER,
    LEGACY_CODE_EXECUTION_HEADER, LEGACY_DSS_INTERNAL_API_KEY_HEADER,
    LEGACY_DSS_INTERNAL_MACRO_USER_ID_HEADER, LEGACY_HARNESS_FOR_MACRO_USER_ID_HEADER,
    LEGACY_HARNESS_TOKEN_HEADER, LEGACY_USER_API_KEY_HEADER, RoxAuthorizationExtractor,
    RoxAuthorizationRejection, RoxAuthorizationState, OptionalRoxAuthorizationExtractor,
    PROGRAM_SIGN_IN_REFUSAL, USER_API_KEY_HEADER, UserBotOrHarness, UserBotOrHarnessAuthorization,
    UserBotOrHarnessEntity, UserOnly, UserOrBot, UserOrBotAuthorization, UserOrBotEntity,
    UserOrInternal, UserOrInternalAuthorization, UserOrInternalCaller, UserOrInternalEntity,
    UserOrInternalService, UserOrInternalServiceAuthorization, is_agent_run, is_program_run,
    marks_code_execution, request_is_program, rewrite_program_json,
};
