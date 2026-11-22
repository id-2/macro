use super::team_refresh_recipients;

fn found(users: &[&str]) -> Vec<Option<String>> {
    users.iter().map(|user| Some((*user).to_string())).collect()
}

#[test]
fn an_inbox_refresh_leaves_its_viewers_to_their_own_refresh() {
    let shared_by = [
        "rox|owner@example.com".to_string(),
        "rox|delegate@example.com".to_string(),
    ];

    let recipients = team_refresh_recipients(
        found(&[
            "rox|owner@example.com",
            "rox|delegate@example.com",
            "rox|teammate@example.com",
        ]),
        &shared_by,
        false,
    );

    assert_eq!(recipients, ["rox|teammate@example.com"]);
}

#[test]
fn a_sharing_change_also_refreshes_the_sharer() {
    let shared_by = ["rox|owner@example.com".to_string()];

    let recipients = team_refresh_recipients(
        found(&["rox|owner@example.com", "rox|teammate@example.com"]),
        &shared_by,
        true,
    );

    assert_eq!(
        recipients,
        ["rox|owner@example.com", "rox|teammate@example.com"]
    );
}
