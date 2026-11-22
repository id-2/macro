use super::*;
use axum::{
    body::Body,
    http::{Request, header},
};
use http_body_util::BodyExt;
use rox_authorization::{
    INTERNAL_API_KEY_HEADER, INTERNAL_ROX_USER_ID_HEADER, InternalAuthConfig, JwtValidator,
    RoxAuthorizationError, RoxAuthorizationServiceImpl, ValidatedIdentity,
};
use rate_limit::{
    RateLimitConfig, RateLimitExceeded, RateLimitKey, RateLimitResult, RateLimitServiceImpl,
    domain::models::RateLimitOk,
};
use rootcause::Report;
use std::collections::HashSet;
use std::sync::{
    Arc,
    atomic::{AtomicUsize, Ordering},
};
use tower::ServiceExt;

const FOUND_USER_ID: &str = "rox|found@test.com";
const NOT_FOUND_USER_ID: &str = "rox|notfound@test.com";
const SENDER_USER_ID: &str = "rox|sender@test.com";
const VALID_INTERNAL_KEY: &str = "valid-internal-key";

struct MockService;

impl ContactsService for MockService {
    async fn query_contacts(
        &self,
        user_id: RoxUserIdStr<'_>,
    ) -> Result<Vec<RoxUserIdStr<'static>>, Report> {
        if user_id.as_ref() != FOUND_USER_ID {
            return Ok(Vec::new());
        }

        Ok([
            "rox|contact1@test.com",
            "rox|contact2@test.com",
            "rox|contact3@test.com",
        ]
        .into_iter()
        .map(|user_id| RoxUserIdStr::try_from(user_id.to_string()).unwrap())
        .collect())
    }

    async fn add_contact_nodes(&self, _nodes: ContactsNodes) -> Result<(), Report> {
        Ok(())
    }
}

/// Echoes the limit it was given as that many people, so tests see the cap.
impl PeopleSearchService for MockService {
    async fn search_people(
        &self,
        viewer: RoxUserIdStr<'_>,
        query: &PeopleSearchQuery,
        limit: PeopleSearchLimit,
    ) -> Result<Vec<PersonMatch>, Report> {
        if query.searchable().is_none() {
            return Ok(Vec::new());
        }
        Ok((0..limit.get())
            .map(|index| {
                let user_id =
                    RoxUserIdStr::try_from(format!("rox|person{index}@example.com")).unwrap();
                PersonMatch {
                    contact: crate::domain::models::contact::Contact {
                        id: crate::domain::models::contact::ContactId::for_viewer(
                            &viewer, &user_id,
                        ),
                        user_id,
                        name: (index == 0).then(|| "Person Zero".to_string()),
                    },
                    is_teammate: index == 0,
                    is_agent: index == 1,
                }
            })
            .collect())
    }
}

#[derive(Clone, Default)]
struct FakeJwtValidator {
    validation_count: Arc<AtomicUsize>,
}

impl FakeJwtValidator {
    fn validation_count(&self) -> usize {
        self.validation_count.load(Ordering::SeqCst)
    }
}

impl JwtValidator for FakeJwtValidator {
    fn validate_credential(
        &self,
        jwt: &str,
    ) -> Result<rox_authorization::ValidatedCredential, Report<RoxAuthorizationError>> {
        self.validation_count.fetch_add(1, Ordering::SeqCst);

        let user_id = match jwt {
            "found" => FOUND_USER_ID,
            "not-found" => NOT_FOUND_USER_ID,
            "sender" => SENDER_USER_ID,
            _ => return Err(Report::new(RoxAuthorizationError::InvalidCredentials)),
        };

        Ok(rox_authorization::ValidatedCredential {
            origin: rox_authorization::CredentialOrigin::Session,
            identity: ValidatedIdentity {
                agent_id: None,
                agent_via: None,
                user_id: user_id.to_string(),
                fusion_user_id: "fusion-user-id".to_string(),
                permissions: None,
                organization_id: None,
            },
        })
    }
}

#[derive(Clone)]
struct MockRateLimitPort {
    should_exceed: bool,
}

impl rate_limit::RateLimitPort for MockRateLimitPort {
    async fn check(
        &self,
        key: RateLimitKey,
        config: RateLimitConfig,
    ) -> Result<RateLimitResult, Report> {
        if self.should_exceed {
            return Ok(Err(RateLimitExceeded {
                current_count: config.max_count.saturating_add(1),
                max_count: config.max_count,
                retry_after: config.window,
            }));
        }

        Ok(Ok(RateLimitOk::new_testing_value(0, key, config)))
    }

    async fn decrement(&self, _key: &RateLimitKey) -> Result<(), Report> {
        Ok(())
    }
}

fn rate_limiter(should_exceed: bool) -> RateLimitServiceImpl<MockRateLimitPort> {
    RateLimitServiceImpl {
        repo: MockRateLimitPort { should_exceed },
    }
}

fn build_test_router(should_exceed: bool) -> (Router, FakeJwtValidator) {
    let validator = FakeJwtValidator::default();
    let authorization_service = RoxAuthorizationServiceImpl::new(
        validator.clone(),
        InternalAuthConfig {
            api_key: VALID_INTERNAL_KEY.to_string(),
            default_user_id: None,
        },
        rox_authorization::NoBotAuthorizer,
        rox_authorization::NoUserApiKeyAuthorizer,
    );
    let state = ContactsRouterState {
        contacts_service: Arc::new(MockService),
        rate_limit_service: rate_limiter(should_exceed),
        authorization_state: RoxAuthorizationState::new(Arc::new(authorization_service)),
    };

    (contacts_router::<_, _, _, ()>(state), validator)
}

fn bearer_get_request(token: &str) -> Request<Body> {
    Request::get("/contacts")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap()
}

fn add_contact_request(token: &str) -> Request<Body> {
    Request::post("/contacts")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            serde_json::json!({"user_id": "rox|recipient@example.com"}).to_string(),
        ))
        .unwrap()
}

#[tokio::test]
async fn bearer_get_returns_contacts() {
    let (api, validator) = build_test_router(false);

    let response = api.oneshot(bearer_get_request("found")).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(validator.validation_count(), 1);
    let body = response.into_body().collect().await.unwrap().to_bytes();
    let body: GetContactsResponse = serde_json::from_slice(&body).unwrap();
    let expected_contacts: HashSet<&str> = [
        "rox|contact1@test.com",
        "rox|contact2@test.com",
        "rox|contact3@test.com",
    ]
    .into_iter()
    .collect();

    assert_eq!(body.contacts.len(), expected_contacts.len());
    for contact in &body.contacts {
        assert!(expected_contacts.contains(contact.as_ref()));
    }
}

#[tokio::test]
async fn bearer_get_returns_not_found() {
    let (api, _) = build_test_router(false);

    let response = api.oneshot(bearer_get_request("not-found")).await.unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn bearer_post_adds_contact_and_validates_once() {
    let (api, validator) = build_test_router(false);

    let response = api.oneshot(add_contact_request("sender")).await.unwrap();

    assert_eq!(response.status(), StatusCode::NO_CONTENT);
    assert_eq!(validator.validation_count(), 1);
}

#[tokio::test]
async fn post_rate_limit_is_preserved() {
    let (api, validator) = build_test_router(true);

    let response = api.oneshot(add_contact_request("sender")).await.unwrap();

    assert_eq!(response.status(), StatusCode::TOO_MANY_REQUESTS);
    assert_eq!(validator.validation_count(), 1);
}

#[tokio::test]
async fn get_is_not_affected_by_post_rate_limit() {
    let (api, _) = build_test_router(true);

    let response = api.oneshot(bearer_get_request("found")).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn missing_credentials_are_rejected() {
    let (api, validator) = build_test_router(false);
    let request = Request::get("/contacts").body(Body::empty()).unwrap();

    let response = api.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    assert_eq!(validator.validation_count(), 0);
}

#[tokio::test]
async fn invalid_credentials_are_rejected() {
    let (api, validator) = build_test_router(false);

    let response = api.oneshot(bearer_get_request("invalid")).await.unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    assert_eq!(validator.validation_count(), 1);
}

#[tokio::test]
async fn internal_acting_user_is_authenticated() {
    let (api, validator) = build_test_router(false);
    let request = Request::get("/contacts")
        .header(INTERNAL_API_KEY_HEADER, VALID_INTERNAL_KEY)
        .header(INTERNAL_ROX_USER_ID_HEADER, FOUND_USER_ID)
        .body(Body::empty())
        .unwrap();

    let response = api.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(validator.validation_count(), 0);
}

#[tokio::test]
async fn internal_request_without_an_identity_is_rejected() {
    let (api, validator) = build_test_router(false);
    let request = Request::get("/contacts")
        .header(INTERNAL_API_KEY_HEADER, VALID_INTERNAL_KEY)
        .body(Body::empty())
        .unwrap();

    let response = api.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    assert_eq!(validator.validation_count(), 0);
}

fn search_request(query_string: &str) -> Request<Body> {
    Request::get(format!("/contacts/search?{query_string}"))
        .header(header::AUTHORIZATION, "Bearer found")
        .body(Body::empty())
        .unwrap()
}

async fn search_body(response: axum::response::Response) -> serde_json::Value {
    let body = response.into_body().collect().await.unwrap().to_bytes();
    serde_json::from_slice(&body).unwrap()
}

#[tokio::test]
async fn search_returns_ranked_people_with_the_default_limit() {
    let (api, _) = build_test_router(false);

    let response = api.oneshot(search_request("query=pe")).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = search_body(response).await;
    let people = body["people"].as_array().unwrap();
    assert_eq!(people.len(), 20);
    assert_eq!(
        people[0],
        serde_json::json!({
            "userId": "rox|person0@example.com",
            "name": "Person Zero",
            "isTeammate": true,
            "isAgent": false,
        })
    );
    assert_eq!(
        people[1],
        serde_json::json!({
            "userId": "rox|person1@example.com",
            "name": null,
            "isTeammate": false,
            "isAgent": true,
        })
    );
}

#[tokio::test]
async fn search_caps_the_limit_at_fifty_and_rejects_zero() {
    let (api, _) = build_test_router(false);
    let response = api
        .clone()
        .oneshot(search_request("query=pe&limit=500"))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        search_body(response).await["people"]
            .as_array()
            .unwrap()
            .len(),
        50
    );

    let response = api
        .clone()
        .oneshot(search_request("query=pe&limit=7"))
        .await
        .unwrap();
    assert_eq!(
        search_body(response).await["people"]
            .as_array()
            .unwrap()
            .len(),
        7
    );

    let response = api
        .oneshot(search_request("query=pe&limit=0"))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn search_with_a_blank_or_short_query_returns_nobody() {
    let (api, _) = build_test_router(false);
    for query_string in ["query=", "query=%20%20", "query=p"] {
        let response = api
            .clone()
            .oneshot(search_request(query_string))
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK, "{query_string}");
        assert_eq!(
            search_body(response).await,
            serde_json::json!({"people": []})
        );
    }
}

#[tokio::test]
async fn search_rate_limit_is_enforced() {
    let (api, validator) = build_test_router(true);

    let response = api.oneshot(search_request("query=pe")).await.unwrap();

    assert_eq!(response.status(), StatusCode::TOO_MANY_REQUESTS);
    assert_eq!(validator.validation_count(), 1);
}

#[tokio::test]
async fn search_rejects_oversized_or_missing_queries_and_anonymous_callers() {
    let (api, _) = build_test_router(false);
    let long = "a".repeat(subsequence_match::MAX_QUERY_BYTES + 1);
    let response = api
        .clone()
        .oneshot(search_request(&format!("query={long}")))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let response = api
        .clone()
        .oneshot(search_request("limit=5"))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let anonymous = Request::get("/contacts/search?query=pe")
        .body(Body::empty())
        .unwrap();
    let response = api.oneshot(anonymous).await.unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}
