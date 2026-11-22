use crate::email::ReadEmailParts;

use super::*;

#[test]
fn it_should_parse() {
    let valid_emails = [
        "macro|sean@rox.one",
        "macro|sean+testing.thing@example.gc.ca",
        "macro|###hello###+weird@something-strange.world.tour",
        "rox|sean@rox.one",
        "rox|sean+testing.thing@example.gc.ca",
        "rox|###hello###+weird@something-strange.world.tour",
    ];
    let res: Result<Vec<_>, _> = valid_emails
        .iter()
        .copied()
        .map(RoxUserId::parse_from_str)
        .collect();
    res.unwrap();
}

#[test]
fn it_should_fail() {
    let invalid_emails = [
        "macro|sean@rox.one ",
        "macro| sean@rox.one",
        "macro|sean@rox.one\n",
        "macro|\nsean@rox.one",
        "macro|sean..aye@rox.one",
        "macro|sean@@rox.one",
        "schmacro|sean@rox.one",
        "Rox|sean@rox.one",
        "ROX|sean@rox.one",
        "rox|sean@rox.one ",
    ];
    invalid_emails
        .iter()
        .copied()
        .map(RoxUserId::parse_from_str)
        .for_each(|res| {
            res.unwrap_err();
        });
}

#[test]
fn email_works() {
    let id = RoxUserId::parse_from_str("macro|###hello###+weird@something-strange.world.tour")
        .unwrap();

    dbg!(&id);

    assert_eq!(
        id.email_part().email_str(),
        "###hello###+weird@something-strange.world.tour"
    );
}

#[test]
fn domain_part_works() {
    let id = RoxUserId::parse_from_str("macro|###hello###+weird@something-strange.world.tour")
        .unwrap();

    dbg!(&id);

    assert_eq!(
        id.email_part().domain_part(),
        "something-strange.world.tour"
    );
}

#[test]
fn local_part_works() {
    let id = RoxUserId::parse_from_str("macro|###hello###+weird@something-strange.world.tour")
        .unwrap();

    dbg!(&id);

    assert_eq!(id.email_part().local_part(), "###hello###+weird");
}

#[test]
fn casing_matters_for_prefix() {
    let _id = RoxUserId::parse_from_str("macRo|###hello###+weird@something-strange.world.tour")
        .unwrap_err();
}

#[test]
fn incomplete_input_does_not_panic() {
    assert!(RoxUserId::parse_from_str("").is_err());
    assert!(RoxUserId::parse_from_str("macro").is_err());
    assert!(RoxUserId::parse_from_str("macro|").is_err());
}

#[test]
fn casing_ignored_for_email() {
    let id = RoxUserId::parse_from_str("macro|###hello###+WEIRD@something-strange.world.tour")
        .unwrap();

    assert_eq!(id.email_part().local_part(), "###hello###+WEIRD");
}

#[test]
fn debug_output_is_simple_string() {
    let id = RoxUserId::parse_from_str("macro|hutch@rox.one").unwrap();
    assert_eq!(format!("{:?}", id), "macro|hutch@rox.one");

    let id_str = RoxUserIdStr::parse_from_str("macro|hutch@rox.one").unwrap();
    assert_eq!(format!("{:?}", id_str), "macro|hutch@rox.one");
}

#[test]
fn macro_com_users_are_staff() {
    let id = RoxUserIdStr::parse_from_str("macro|teo@rox.one").unwrap();
    assert!(id.is_macro_staff());
}

#[test]
fn macro_com_plus_aliases_are_staff() {
    let id = RoxUserIdStr::parse_from_str("macro|teo+notify@rox.one").unwrap();
    assert!(id.is_macro_staff());
}

#[test]
fn non_macro_domains_are_not_staff() {
    let id = RoxUserIdStr::parse_from_str("macro|teo@example.com").unwrap();
    assert!(!id.is_macro_staff());
}

#[test]
fn it_should_fail_this() {
    RoxUserIdStr::parse_from_str("macro|a'or$1=$1or'x'='x@y.com").unwrap_err();
}

#[test]
fn prefix_is_remembered() {
    let legacy = RoxUserId::parse_from_str("macro|sean@rox.one").unwrap();
    assert_eq!(legacy.prefix(), UserIdPrefix::Macro);
    assert!(legacy.has_legacy_prefix());
    assert_eq!(legacy.email_str(), "sean@rox.one");

    let current = RoxUserId::parse_from_str("rox|sean@rox.one").unwrap();
    assert_eq!(current.prefix(), UserIdPrefix::Rox);
    assert!(!current.has_legacy_prefix());
    assert_eq!(current.email_str(), "sean@rox.one");
}

#[test]
fn canonical_rewrites_only_the_prefix() {
    let legacy = RoxUserIdStr::parse_from_str("macro|Sean+Tag@Rox.One").unwrap();
    assert_eq!(legacy.as_ref(), "macro|sean+tag@rox.one");
    let canonical = legacy.canonical();
    assert_eq!(canonical.as_ref(), "rox|sean+tag@rox.one");
    assert_eq!(canonical.prefix(), UserIdPrefix::Rox);

    let current = RoxUserIdStr::parse_from_str("rox|sean@rox.one").unwrap();
    assert_eq!(current.canonical().as_ref(), "rox|sean@rox.one");
}

#[test]
fn constructor_writes_rox_prefix() {
    let id = RoxUserIdStr::try_from_email("sean+tag@rox.one").unwrap();
    assert_eq!(id.as_ref(), "rox|sean+tag@rox.one");
    assert_eq!(id.prefix(), UserIdPrefix::Rox);
}

#[test]
fn strip_helper_accepts_both_prefixes() {
    assert_eq!(strip_user_id_prefix("macro|sean@rox.one"), "sean@rox.one");
    assert_eq!(strip_user_id_prefix("rox|sean@rox.one"), "sean@rox.one");
    assert_eq!(strip_user_id_prefix("sean@rox.one"), "sean@rox.one");
}
