use crate::api::context::ApiContext;
use cookie::{Cookie, SameSite};
use email::domain::ports::{FirstInboxProvisionOutcome, FirstInboxProvisioner};
use rox_auth::constant::{access_token_cookie_names, refresh_token_cookie_names};
use rox_env::Environment;
use rox_env_var::maybe_env_vars;
use rand::{Rng, seq::SliceRandom};
use url::Url;

maybe_env_vars! {
    struct FrontendPort;
    struct FrontendOrigin;
}

/// Generates a random 25 character session code
pub fn generate_session_code() -> String {
    const CHARSET_LOWER: &[u8] = b"abcdefghijklmnopqrstuvwxyz";
    const CHARSET_UPPER: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const CHARSET_NUMBERS: &[u8] = b"0123456789";

    let mut rng = rand::rng();
    let mut code = String::with_capacity(25);

    // Ensure at least one character from each set
    code.push(CHARSET_LOWER[rng.random_range(0..CHARSET_LOWER.len())] as char);
    code.push(CHARSET_UPPER[rng.random_range(0..CHARSET_UPPER.len())] as char);
    code.push(CHARSET_NUMBERS[rng.random_range(0..CHARSET_NUMBERS.len())] as char);

    // Combine all charsets for remaining characters
    let combined_charset: Vec<u8> = CHARSET_LOWER
        .iter()
        .chain(CHARSET_UPPER)
        .chain(CHARSET_NUMBERS)
        .copied()
        .collect();

    // Fill the remaining 22 characters
    for _ in 0..22 {
        let idx = rng.random_range(0..combined_charset.len());
        code.push(combined_charset[idx] as char);
    }

    // Shuffle the entire code to avoid predictable character positions
    let mut code_chars: Vec<char> = code.chars().collect();
    code_chars.shuffle(&mut rng);

    code_chars.into_iter().collect()
}

/// Returns the default redirect url based on the environment
pub fn default_redirect_url() -> Url {
    match Environment::new_or_prod() {
        Environment::Local => {
            if let Some(origin) = FrontendOrigin::new() {
                return origin.parse().unwrap_or_else(|_| {
                    panic!("FRONTEND_ORIGIN must be a URL, got {}", origin.as_ref())
                });
            }
            let port = FrontendPort::new()
                .map(|port| port.to_string())
                .unwrap_or_else(|| "3000".to_string());
            format!("http://localhost:{port}").parse().unwrap()
        }
        Environment::Develop => "https://dev.rox.one/app".parse().unwrap(),
        Environment::Production => "https://rox.one/app".parse().unwrap(),
    }
}

/// The DOMAIN attribute of the session cookies, or `None` for a host-only
/// cookie.
///
/// Local names the parent domain so every local hostname under `rox.one`
/// (`app.rox.one` and `my.rox.one`, both served by the local reverse proxy)
/// shares one session. Hosts outside that suffix — `localhost`, a machine
/// name, a tunnel — receive no session cookie at all, because browsers drop a
/// `Set-Cookie` whose domain is not a suffix of the request host.
fn domain<'a>() -> Option<&'a str> {
    match Environment::new_or_prod() {
        Environment::Local => Some(".rox.one"),
        Environment::Production | Environment::Develop => Some("rox.one"),
    }
}

fn same_site() -> SameSite {
    match Environment::new_or_prod() {
        Environment::Production => SameSite::Strict,
        // `app.rox.one` and `my.rox.one` are one site, so Lax still carries the
        // session between them; it costs nothing there and keeps the cookie
        // off third-party requests.
        Environment::Local => SameSite::Lax,
        Environment::Develop => SameSite::None,
    }
}

/// Builds a session cookie with the attributes every session cookie shares:
/// secure, http-only, the environment's `SameSite`/domain, site-wide path and a
/// one-year expiry.
fn session_cookie(name: String, token: &str) -> Cookie<'static> {
    let mut cookie = Cookie::new(name, token.to_owned());
    cookie.set_secure(true);
    cookie.set_http_only(true);
    cookie.set_same_site(same_site());
    if let Some(domain) = domain() {
        cookie.set_domain(domain);
    }
    cookie.set_path("/");
    cookie.set_expires(Some(
        time::OffsetDateTime::now_utc() + time::Duration::days(365),
    ));
    cookie
}

pub fn create_access_token_cookie(token: &str) -> Cookie<'static> {
    session_cookie(access_token_cookie_names()[0].clone(), token)
}

pub fn create_refresh_token_cookie(token: &str) -> Cookie<'static> {
    session_cookie(refresh_token_cookie_names()[0].clone(), token)
}

/// Cookies that expired the pre-rename `macro-*` session cookies the browser
/// may still carry. Sent wherever the session is rotated or ended: the server
/// accepts the legacy names on read, so an ended session has to clear them too
/// or the browser would keep authenticating with them.
pub fn expired_legacy_session_cookies() -> Vec<Cookie<'static>> {
    let names = [
        access_token_cookie_names()[1].clone(),
        refresh_token_cookie_names()[1].clone(),
    ];
    let expires = Some(time::OffsetDateTime::now_utc());
    names
        .into_iter()
        .map(|name| {
            let mut cookie = session_cookie(name, "");
            cookie.set_expires(expires);
            cookie
        })
        .collect()
}

/// If this account was created during the auth flow that is completing (the
/// create-user webhook marks it in the cache), appends `signed_up=true` to the
/// redirect URL so the app can attribute the session as a signup for
/// analytics. Best-effort: never fails the login.
pub async fn append_signed_up_param_if_new_user(
    rox_cache_client: &rox_cache_client::RoxCache,
    email: &str,
    redirect_url: &mut Url,
) -> bool {
    match rox_cache_client.take_user_just_signed_up(email).await {
        Ok(true) => {
            redirect_url
                .query_pairs_mut()
                .append_pair("signed_up", "true");
            true
        }
        Ok(false) => false,
        Err(e) => {
            tracing::error!(error=?e, "unable to check just-signed-up marker");
            false
        }
    }
}

/// Provisions the user's primary inbox as a side effect of authentication,
/// the moment a fresh access token exists. Fire-and-forget so the login
/// response is never delayed. The email service arbitrates: a login without a
/// usable Gmail grant is an expected no-op, and init is idempotent and recurs
/// on every login, so a lost attempt only delays provisioning until the next one.
pub fn spawn_first_inbox_provision(ctx: &ApiContext, access_token: &str) {
    let email_service_client = ctx.email_service_client.clone();
    let access_token = access_token.to_string();

    tokio::spawn(async move {
        match email_service_client
            .provision_first_inbox(&access_token)
            .await
        {
            Ok(FirstInboxProvisionOutcome::Provisioned) => {
                tracing::info!("first-inbox provision: inbox initialized on login");
            }
            Ok(FirstInboxProvisionOutcome::Skipped) => {}
            Err(e) => {
                tracing::warn!(error=?e, "first-inbox provision: init failed");
            }
        }
    });
}
