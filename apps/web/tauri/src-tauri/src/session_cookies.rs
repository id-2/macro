//! Keeps the native HTTP cookie jar to one session per cookie name.
//!
//! A cookie name can legitimately live twice in a jar: once host-only (a
//! service that set it without `Domain`) and once domain-wide. Browsers send
//! both, and the services read the last one, so a sign-in that switched scope
//! leaves an older token beside the current one. Every request then carries two
//! access tokens: the stale one can be expired (401) or belong to another login
//! (a refused request), and the outcome depends on header order alone.
//!
//! The jar's persisted snapshot names each cookie's scope, so this prunes on
//! disk-approved scope: for every cookie name and path that a request would see
//! twice, keep the newest (a token's own `exp` claim first, then the cookie's
//! expiry) and expire the rest in their own scope.

use reqwest::cookie::CookieStore;
use reqwest::header::HeaderValue;
use serde::Deserialize;
use std::collections::HashMap;
use tauri::{AppHandle, Manager, Runtime};

/// One cookie as the jar serializes it: the full `Set-Cookie` text plus the
/// scope the store keyed it under.
#[derive(Debug, Deserialize)]
struct StoredCookie {
    raw_cookie: String,
    #[serde(default)]
    domain: Option<StoredDomain>,
    #[serde(default)]
    expires: Option<StoredExpiry>,
}

#[derive(Debug, Deserialize)]
enum StoredDomain {
    /// Set without `Domain`; the key is the host that set it.
    HostOnly(String),
    /// Set with `Domain`; the key is the parent domain.
    Suffix(String),
}

#[derive(Debug, Deserialize)]
enum StoredExpiry {
    AtUtc(String),
}

impl StoredExpiry {
    fn text(&self) -> &str {
        match self {
            Self::AtUtc(value) => value,
        }
    }
}

#[derive(Debug, Clone)]
enum Scope {
    HostOnly(String),
    Suffix(String),
}

impl Scope {
    /// The host a deletion request must use so the store matches this scope.
    fn delete_host(&self) -> &str {
        match self {
            Self::HostOnly(host) => host,
            Self::Suffix(domain) => domain,
        }
    }

    /// The `Domain` attribute of the deletion cookie, if the entry had one.
    fn domain_attribute(&self) -> Option<String> {
        match self {
            Self::HostOnly(_) => None,
            Self::Suffix(domain) => Some(domain.clone()),
        }
    }

    /// Whether one cookie can shadow the other for the same request.
    fn overlaps(&self, other: &Scope) -> bool {
        match (self, other) {
            (Self::Suffix(a), Self::Suffix(b)) => a == b,
            (Self::Suffix(domain), Self::HostOnly(host))
            | (Self::HostOnly(host), Self::Suffix(domain)) => hosts_under(host, domain),
            (Self::HostOnly(a), Self::HostOnly(b)) => a == b,
        }
    }
}

fn hosts_under(host: &str, domain: &str) -> bool {
    host == domain
        || host
            .strip_suffix(domain)
            .is_some_and(|prefix| prefix.ends_with('.'))
}

/// A parsed cookie: the parts a prune needs.
struct Candidate {
    name: String,
    /// The stored `Set-Cookie` text, kept so a rename can rewrite its name.
    raw: String,
    path: String,
    value: String,
    scope: Scope,
    /// The cookie's own expiry, which follows when it was set.
    expires: String,
    /// Where the jar lists it; the store's order is the server's last-wins one.
    order: usize,
}

impl Candidate {
    fn from_stored(index: usize, stored: &StoredCookie) -> Option<Self> {
        let mut parts = stored.raw_cookie.split(';');
        let pair = parts.next()?.trim();
        let (name, value) = pair.split_once('=')?;
        if name.is_empty() {
            return None;
        }
        let mut path = "/".to_string();
        for attribute in parts {
            let Some((key, value)) = attribute.trim().split_once('=') else {
                continue;
            };
            if key.trim().eq_ignore_ascii_case("path") && !value.trim().is_empty() {
                path = value.trim().to_string();
            }
        }
        let scope = match stored.domain.as_ref()? {
            StoredDomain::HostOnly(host) => Scope::HostOnly(host.clone()),
            StoredDomain::Suffix(domain) => Scope::Suffix(domain.clone()),
        };
        Some(Self {
            name: name.trim().to_string(),
            raw: stored.raw_cookie.clone(),
            path,
            value: value.to_string(),
            scope,
            expires: stored
                .expires
                .as_ref()
                .map(|expiry| expiry.text().to_string())
                .unwrap_or_default(),
            order: index,
        })
    }

    /// The newest cookie in a shadowing group: a token's own `exp` claim is the
    /// most precise age, the cookie expiry breaks ties, and the jar's order is
    /// the last resort (it is what the server reads last today).
    fn rank(&self) -> (i64, &str, usize) {
        (jwt_exp(&self.value).unwrap_or(i64::MIN), &self.expires, self.order)
    }

    fn deletion_header(&self) -> String {
        let mut header = format!("{}=; Max-Age=0; Path={}", self.name, self.path);
        if let Some(domain) = self.scope.domain_attribute() {
            header.push_str("; Domain=");
            header.push_str(&domain);
        }
        header
    }
}

/// The `exp` claim of a JWT-shaped value, in seconds. Opaque values have none.
fn jwt_exp(value: &str) -> Option<i64> {
    let payload = value.split('.').nth(1)?;
    let decoded = base64url_decode(payload)?;
    let claims: serde_json::Value = serde_json::from_slice(&decoded).ok()?;
    claims.get("exp")?.as_i64()
}

fn base64url_decode(input: &str) -> Option<Vec<u8>> {
    let mut accumulator: u32 = 0;
    let mut bits = 0;
    let mut out = Vec::with_capacity(input.len() * 3 / 4 + 3);
    for byte in input.bytes() {
        let digit = match byte {
            b'A'..=b'Z' => byte - b'A',
            b'a'..=b'z' => byte - b'a' + 26,
            b'0'..=b'9' => byte - b'0' + 52,
            b'-' | b'+' => 62,
            b'_' | b'/' => 63,
            b'=' => break,
            _ => return None,
        } as u32;
        accumulator = (accumulator << 6) | digit;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((accumulator >> bits) as u8);
        }
    }
    Some(out)
}


/// Session cookie names from before the product rename. Sign-in writes only
/// the new names; a jar written by an older build is carried over, keeping
/// whatever stand prefix it had (`macro-<stand>--` becomes `rox-<stand>--`).
fn current_name(name: &str) -> String {
    let is_session = name.ends_with("access-token") || name.ends_with("refresh-token");
    if is_session && name.contains("macro-") {
        name.replace("macro-", "rox-")
    } else {
        name.to_string()
    }
}

fn request_url(scope: &Scope, path: &str) -> Option<url::Url> {
    let path = if path.starts_with('/') {
        path.to_string()
    } else {
        format!("/{path}")
    };
    format!("https://{}{}", scope.delete_host(), path)
        .parse()
        .ok()
}

/// Re-set a legacy-named cookie under its current name, then expire the old
/// one. Writing first keeps the session if the store refuses the new cookie.
fn migrate_names<C: CookieStore + ?Sized>(jar: &C, cookies: &[Candidate]) -> usize {
    let mut migrated = 0usize;
    for cookie in cookies {
        let name = current_name(&cookie.name);
        if name == cookie.name {
            continue;
        }
        let Some(url) = request_url(&cookie.scope, &cookie.path) else {
            continue;
        };
        let rewritten = match cookie.raw.split_once('=') {
            Some((_, rest)) => format!("{name}={rest}"),
            None => continue,
        };
        let (Ok(value), Ok(expired)) = (
            HeaderValue::from_str(&rewritten),
            HeaderValue::from_str(&cookie.deletion_header()),
        ) else {
            continue;
        };
        jar.set_cookies(&mut std::iter::once(&value), &url);
        jar.set_cookies(&mut std::iter::once(&expired), &url);
        tracing::info!(from = %cookie.name, to = %name, "renamed a legacy session cookie");
        migrated += 1;
    }
    migrated
}

/// Expire every duplicate a request would see twice in `jar`, keeping the
/// newest, then rename legacy session cookies. Returns how many were expired.
pub fn prune_duplicates<R: Runtime>(app: &AppHandle<R>) -> Result<usize, String> {
    let Some(http) = app.try_state::<tauri_plugin_http::Http>() else {
        return Err("http plugin is not installed".to_string());
    };
    let jar = http.inner().cookies_jar.clone();
    // Group from the store's own snapshot: ask for a fresh save and wait for
    // it, so a cookie set by the response that just landed is included.
    if let Ok(saved) = jar.request_save() {
        let _ = saved.recv_timeout(std::time::Duration::from_millis(1_000));
    }
    let serialized = std::fs::read_to_string(&jar.path)
        .map_err(|error| format!("cookie jar is unreadable: {error}"))?;
    let stored: Vec<StoredCookie> = serde_json::from_str(&serialized)
        .map_err(|error| format!("cookie jar is not JSON: {error}"))?;
    let candidates: Vec<Candidate> = stored
        .iter()
        .enumerate()
        .filter_map(|(index, cookie)| Candidate::from_stored(index, cookie))
        .collect();

    // Group the cookies one request could see together (same name and path in
    // overlapping scopes), so a host-only cookie and the domain-wide one that
    // shadows it are compared, while unrelated hosts stay apart.
    let mut parent: Vec<usize> = (0..candidates.len()).collect();
    fn root(parent: &mut [usize], mut index: usize) -> usize {
        while parent[index] != index {
            parent[index] = parent[parent[index]];
            index = parent[index];
        }
        index
    }
    for left in 0..candidates.len() {
        for right in left + 1..candidates.len() {
            let (a, b) = (&candidates[left], &candidates[right]);
            if a.name != b.name || a.path != b.path || !a.scope.overlaps(&b.scope) {
                continue;
            }
            let (ra, rb) = (root(&mut parent, left), root(&mut parent, right));
            if ra != rb {
                parent[ra] = rb;
            }
        }
    }

    let mut groups: HashMap<usize, Vec<usize>> = HashMap::new();
    for index in 0..candidates.len() {
        let group = root(&mut parent, index);
        groups.entry(group).or_default().push(index);
    }

    let mut expired = 0usize;
    let mut expired_indices: Vec<usize> = Vec::new();
    for members in groups.into_values() {
        if members.len() < 2 {
            continue;
        }
        let mut ordered = members;
        ordered.sort_by(|left, right| {
            candidates[*left].rank().cmp(&candidates[*right].rank())
        });
        let (keep, remove) = ordered.split_last().expect("group has a member");
        for index in remove {
            let cookie = &candidates[*index];
            let Some(url) = request_url(&cookie.scope, &cookie.path) else {
                continue;
            };
            let header = cookie.deletion_header();
            let Ok(value) = HeaderValue::from_str(&header) else {
                continue;
            };
            jar.set_cookies(&mut std::iter::once(&value), &url);
            expired_indices.push(*index);
            expired += 1;
        }
        tracing::info!(
            cookie = %candidates[*keep].name,
            removed = remove.len(),
            "pruned duplicate session cookies"
        );
    }
    let survivors: Vec<Candidate> = candidates
        .into_iter()
        .enumerate()
        .filter(|(index, _)| !expired_indices.contains(index))
        .map(|(_, cookie)| cookie)
        .collect();
    migrate_names(jar.as_ref(), &survivors);
    Ok(expired)
}

#[tauri::command]
pub fn prune_session_cookies<R: Runtime>(app: AppHandle<R>) -> Result<usize, String> {
    prune_duplicates(&app)
}

#[cfg(test)]
mod test {
    use super::*;

    fn stored(raw: &str, domain: &str, expires: &str) -> StoredCookie {
        serde_json::from_str(&format!(
            r#"{{"raw_cookie":"{raw}","domain":{domain},"expires":{expires}}}"#
        ))
        .expect("stored cookie")
    }

    #[test]
    fn ranks_a_live_token_above_an_expired_twin() {
        let token = |exp: i64| {
            let claims = serde_json::json!({ "exp": exp }).to_string();
            let payload = claims.into_bytes();
            const ALPHABET: &[u8; 64] =
                b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
            let mut encoded = String::new();
            for chunk in payload.chunks(3) {
                let mut block = [0u8; 3];
                block[..chunk.len()].copy_from_slice(chunk);
                let value = ((block[0] as u32) << 16)
                    | ((block[1] as u32) << 8)
                    | block[2] as u32;
                let produced = match chunk.len() {
                    1 => 2,
                    2 => 3,
                    _ => 4,
                };
                for shift in [18, 12, 6, 0].into_iter().take(produced) {
                    encoded.push(ALPHABET[((value >> shift) & 63) as usize] as char);
                }
            }
            encoded
        };
        let old = token(10);
        let new = token(20);
        assert_eq!(jwt_exp(&format!("h.{old}.sig")), Some(10));
        assert_eq!(jwt_exp(&format!("h.{new}.sig")), Some(20));
        assert_eq!(jwt_exp("opaque"), None);
    }

    #[test]
    fn reads_scope_path_and_deletion_header() {
        let cookie = Candidate::from_stored(
            0,
            &stored(
                "session=abc; HttpOnly; Path=/app; Secure; Domain=rox.one",
                r#"{"Suffix":"rox.one"}"#,
                r#"{"AtUtc":"2027-01-01T00:00:00Z"}"#,
            ),
        )
        .expect("parsed");
        assert_eq!(cookie.name, "session");
        assert_eq!(cookie.path, "/app");
        assert_eq!(
            cookie.deletion_header(),
            "session=; Max-Age=0; Path=/app; Domain=rox.one"
        );
        let host_only = Candidate::from_stored(
            1,
            &stored(
                "session=abc; Path=/",
                r#"{"HostOnly":"app.rox.one"}"#,
                r#"{"AtUtc":"2027-01-01T00:00:00Z"}"#,
            ),
        )
        .expect("parsed");
        assert_eq!(
            host_only.deletion_header(),
            "session=; Max-Age=0; Path=/"
        );
        assert_eq!(host_only.scope.delete_host(), "app.rox.one");
    }

    #[test]
    fn scopes_overlap_only_within_one_domain() {
        assert!(Scope::Suffix("rox.one".into()).overlaps(&Scope::HostOnly("app.rox.one".into())));
        assert!(!Scope::Suffix("rox.one".into()).overlaps(&Scope::HostOnly("evilrox.one".into())));
        assert!(!Scope::HostOnly("a.example".into()).overlaps(&Scope::HostOnly("b.example".into())));
    }
}
