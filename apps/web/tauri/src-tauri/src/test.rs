use super::navigation_plugin;
use url::Url;

/// The main webview runs the app with its native commands, so a page
/// navigation loads only the app's own documents. Any other page, including
/// Pipedream Connect, opens in the system browser: the webview's navigation
/// handler cannot tell a frame from the page, so allowing a third-party
/// document anywhere would also let it replace the app.
#[test]
fn main_webview_loads_only_the_apps_own_documents() {
    let navigation = navigation_plugin();

    for url in [
        "https://pipedream.com/_static/connect.html",
        "https://pipedream.com/_static/connect.html?token=ctok_1&app=github",
        "https://example.com/",
        "https://macro.com/pricing",
    ] {
        assert!(
            !navigation.loads_in_webview(&Url::parse(url).unwrap()),
            "{url}"
        );
    }

    for url in [
        "tauri://localhost/index.html",
        "http://tauri.localhost/index.html",
        "https://tauri.localhost/index.html",
    ] {
        assert!(
            navigation.loads_in_webview(&Url::parse(url).unwrap()),
            "{url}"
        );
    }
}

/// `rox://` is the scheme the app emits; `macro://` links already sent in
/// emails or produced by older builds must reach the same router destination.
#[test]
fn rox_and_legacy_macro_links_resolve_to_the_same_route() {
    for (current, legacy) in [
        ("rox:///login?token=abc", "macro:///login?token=abc"),
        (
            "rox://auth/callback?code=1&state=x",
            "macro://auth/callback?code=1&state=x",
        ),
        (
            "rox:///external?whatsappPairing=42",
            "macro:///external?whatsappPairing=42",
        ),
    ] {
        let current = super::resolve_deep_link_route(Url::parse(current).unwrap()).unwrap();
        let legacy = super::resolve_deep_link_route(Url::parse(legacy).unwrap()).unwrap();
        assert_eq!(current.path(), legacy.path(), "{current} vs {legacy}");
        assert_eq!(current.query(), legacy.query(), "{current} vs {legacy}");
        assert_eq!(current.fragment(), legacy.fragment(), "{current} vs {legacy}");
    }
}

#[test]
fn deep_link_router_rejects_foreign_schemes() {
    assert!(super::resolve_deep_link_route(Url::parse("cap:///login").unwrap()).is_err());
}
