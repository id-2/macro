use super::*;

fn env_of(pairs: &[(&str, &str)]) -> BTreeMap<String, String> {
    pairs
        .iter()
        .map(|(name, value)| (name.to_string(), value.to_string()))
        .collect()
}

#[test]
fn the_emulator_does_not_stand_in_for_microsoft_login() {
    let none = env_of(&[]);
    let emulated = env_of(&[("MICROSOFT_CLIENT_ID", "local-microsoft-client")]);
    let real = env_of(&[(
        "MICROSOFT_CLIENT_ID",
        "0195a000-0000-7000-8000-0000000c11e7",
    )]);

    assert!(!stands_in(Mode::Local, &none));
    assert!(!stands_in(Mode::Local, &emulated));
    assert!(!stands_in(Mode::Local, &real));
    assert!(!stands_in(Mode::Dev, &none));
}
