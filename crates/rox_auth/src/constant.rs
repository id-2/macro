/// The name of the cookie that contains the JWT access token.
///
/// Sign-in writes only this name. Readers also accept
/// [`LEGACY_ACCESS_TOKEN_COOKIE`], so a session issued before the rename keeps
/// working until its token is rewritten.
pub static MACRO_ACCESS_TOKEN_COOKIE: &str = "rox-access-token";
pub static MACRO_REFRESH_TOKEN_COOKIE: &str = "rox-refresh-token";

/// The names these cookies had before the rename. Read-only: nothing sets
/// them, and they stay accepted until they are retired on purpose.
pub static LEGACY_ACCESS_TOKEN_COOKIE: &str = "macro-access-token";
pub static LEGACY_REFRESH_TOKEN_COOKIE: &str = "macro-refresh-token";

/// Header carrying the refresh token. Clients send only this name; readers
/// also accept [`LEGACY_REFRESH_TOKEN_HEADER`].
pub static MACRO_REFRESH_TOKEN_HEADER: &str = "x-rox-refresh-token";

/// The header these clients sent before the rename. Read-only: nothing sets
/// it, and it stays accepted until it is retired on purpose.
pub static LEGACY_REFRESH_TOKEN_HEADER: &str = "x-macro-refresh-token";
