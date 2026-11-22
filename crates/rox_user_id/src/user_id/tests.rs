use crate::email::ReadEmailParts;

use super::*;

#[test]
fn it_should_parse() {
    let valid_emails = [
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
        "rox|sean@rox.one ",
        "rox| sean@rox.one",
        "rox|sean@rox.one\n",
        "rox|\nsean@rox.one",
        "rox|sean..aye@rox.one",
        "rox|sean@@rox.one",
        "schrox|sean@rox.one",
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
    let id = RoxUserId::parse_from_str("rox|###hello###+weird@something-strange.world.tour")
        .unwrap();

    dbg!(&id);

    assert_eq!(
        id.email_part().email_str(),
        "###hello###+weird@something-strange.world.tour"
    );
}

#[test]
fn domain_part_works() {
    let id = RoxUserId::parse_from_str("rox|###hello###+weird@something-strange.world.tour")
        .unwrap();

    dbg!(&id);

    assert_eq!(
        id.email_part().domain_part(),
        "something-strange.world.tour"
    );
}

#[test]
fn local_part_works() {
    let id = RoxUserId::parse_from_str("rox|###hello###+weird@something-strange.world.tour")
        .unwrap();

    dbg!(&id);

    assert_eq!(id.email_part().local_part(), "###hello###+weird");
}

#[test]
fn casing_matters_for_prefix() {
    let _id = RoxUserId::parse_from_str("roX|###hello###+weird@something-strange.world.tour")
        .unwrap_err();
}

#[test]
fn incomplete_input_does_not_panic() {
    assert!(RoxUserId::parse_from_str("").is_err());
    assert!(RoxUserId::parse_from_str("macro").is_err());
    assert!(RoxUserId::parse_from_str("rox|").is_err());
}

#[test]
fn casing_ignored_for_email() {
    let id = RoxUserId::parse_from_str("rox|###hello###+WEIRD@something-strange.world.tour")
        .unwrap();

    assert_eq!(id.email_part().local_part(), "###hello###+WEIRD");
}

#[test]
fn debug_output_is_simple_string() {
    let id = RoxUserId::parse_from_str("rox|hutch@rox.one").unwrap();
    assert_eq!(format!("{:?}", id), "rox|hutch@rox.one");

    let id_str = RoxUserIdStr::parse_from_str("rox|hutch@rox.one").unwrap();
    assert_eq!(format!("{:?}", id_str), "rox|hutch@rox.one");
}

#[test]
fn rox_com_users_are_staff() {
    let id = RoxUserIdStr::parse_from_str("rox|teo@rox.one").unwrap();
    assert!(id.is_rox_staff());
}

#[test]
fn rox_com_plus_aliases_are_staff() {
    let id = RoxUserIdStr::parse_from_str("rox|teo+notify@rox.one").unwrap();
    assert!(id.is_rox_staff());
}

#[test]
fn non_rox_domains_are_not_staff() {
    let id = RoxUserIdStr::parse_from_str("rox|teo@example.com").unwrap();
    assert!(!id.is_rox_staff());
}

#[test]
fn it_should_fail_this() {
    RoxUserIdStr::parse_from_str("rox|a'or$1=$1or'x'='x@y.com").unwrap_err();
}
