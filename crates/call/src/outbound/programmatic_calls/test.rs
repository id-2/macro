use super::*;

async fn enabled(gate: &LocalProgrammaticCalls) -> bool {
    gate.enabled_for(RoxUserIdStr::try_from("rox|local@example.com").unwrap())
        .await
}

#[tokio::test]
async fn local_switch_defaults_to_enabled() {
    assert_eq!(local_default_from(None), true);
    assert!(enabled(&LocalProgrammaticCalls::from_env()).await || {
        // An inherited disabling environment value is legitimate; only the
        // unset default is asserted here.
        false
    });
}

#[tokio::test]
async fn local_switch_reads_disabling_values() {
    for value in ["false", "FALSE", "0", "no", "off", " off "] {
        assert!(!local_default_from(Some(value.to_owned())), "{value}");
    }
    for value in ["true", "1", "yes", "on", ""] {
        assert!(local_default_from(Some(value.to_owned())), "{value}");
    }
}

#[tokio::test]
async fn local_switch_honours_an_explicit_decision() {
    assert!(enabled(&LocalProgrammaticCalls::new(true)).await);
    assert!(!enabled(&LocalProgrammaticCalls::new(false)).await);
}
