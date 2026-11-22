use rox_env::Environment;

/// The name of the cookie that contains the JWT access token
pub static ROX_ACCESS_TOKEN_COOKIE: &str = "rox-access-token";
pub static ROX_REFRESH_TOKEN_COOKIE: &str = "rox-refresh-token";
pub static ROX_REFRESH_TOKEN_HEADER: &str = "x-rox-refresh-token";

/// The pre-rename names of the session cookies. Browsers signed in before the
/// rename still carry these, so they are accepted on read for the transition
/// period; every write uses the current `rox-*` name above.
pub static LEGACY_ACCESS_TOKEN_COOKIE: &str = "macro-access-token";
pub static LEGACY_REFRESH_TOKEN_COOKIE: &str = "macro-refresh-token";

/// The environment-scoped name of a session cookie: `dev-`/`local-` prefixed
/// outside production so instances on one host never share a session.
pub fn session_cookie_name(base: &str) -> String {
    match Environment::new_or_prod() {
        Environment::Production => base.to_string(),
        Environment::Develop => format!("dev-{base}"),
        Environment::Local => format!("local-{base}"),
    }
}

/// Cookie names to read for the access token, most current first. The second
/// name is the legacy `macro-*` cookie a live session may still carry.
pub fn access_token_cookie_names() -> [String; 2] {
    [
        session_cookie_name(ROX_ACCESS_TOKEN_COOKIE),
        session_cookie_name(LEGACY_ACCESS_TOKEN_COOKIE),
    ]
}

/// Cookie names to read for the refresh token, most current first.
pub fn refresh_token_cookie_names() -> [String; 2] {
    [
        session_cookie_name(ROX_REFRESH_TOKEN_COOKIE),
        session_cookie_name(LEGACY_REFRESH_TOKEN_COOKIE),
    ]
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn cookie_names_read_current_then_legacy() {
        let access = access_token_cookie_names();
        assert!(access[0].ends_with(ROX_ACCESS_TOKEN_COOKIE), "{access:?}");
        assert!(access[1].ends_with(LEGACY_ACCESS_TOKEN_COOKIE), "{access:?}");

        let refresh = refresh_token_cookie_names();
        assert!(refresh[0].ends_with(ROX_REFRESH_TOKEN_COOKIE), "{refresh:?}");
        assert!(
            refresh[1].ends_with(LEGACY_REFRESH_TOKEN_COOKIE),
            "{refresh:?}"
        );
    }
}
