use super::*;

fn env_of(pairs: &[(&str, &str)]) -> BTreeMap<String, String> {
    pairs
        .iter()
        .map(|(name, value)| (name.to_string(), value.to_string()))
        .collect()
}

#[test]
fn the_emulator_does_not_stand_in_for_google_login() {
    let placeholders = env_of(&[
        ("GOOGLE_CLIENT_ID", "local-google-client"),
        ("GOOGLE_CLIENT_SECRET_KEY", "local-google-client-secret"),
    ]);
    let real = env_of(&[
        ("GOOGLE_CLIENT_ID", "abc.apps.googleusercontent.com"),
        ("GOOGLE_CLIENT_SECRET_KEY", "GOCSPX-real"),
    ]);

    assert!(!stands_in(Mode::Local, &placeholders));
    assert!(!stands_in(Mode::Local, &real));
    assert!(!stands_in(Mode::Dev, &placeholders));
}
