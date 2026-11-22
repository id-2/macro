use super::*;

#[test]
fn a_code_mode_program_or_an_agent_token_counts_as_an_agent_run() {
    let mut program = HeaderMap::new();
    program.insert(CODE_EXECUTION_HEADER, "1".parse().unwrap());
    let browser = HeaderMap::new();

    assert!(
        is_agent_run(CredentialAttribution::Person, &program),
        "a request code mode marked, whatever its credential"
    );
    assert!(
        is_agent_run(CredentialAttribution::Agent, &browser),
        "an agent-attributed token"
    );
    assert!(
        !is_agent_run(CredentialAttribution::Routine, &browser),
        "an owner routine step may still send and create"
    );
    assert!(
        !is_agent_run(CredentialAttribution::Person, &browser),
        "a person in the app"
    );
}

#[test]
fn every_program_counts_as_a_program_run() {
    let mut program = HeaderMap::new();
    program.insert(CODE_EXECUTION_HEADER, "1".parse().unwrap());
    let browser = HeaderMap::new();

    assert!(is_program_run(CredentialAttribution::Person, &program));
    assert!(is_program_run(CredentialAttribution::Agent, &browser));
    assert!(is_program_run(CredentialAttribution::Routine, &browser));
    assert!(!is_program_run(CredentialAttribution::Person, &browser));
}

/// A program or runtime that predates the rename still marks its requests
/// with the old name, and that mark counts exactly as the new one.
#[test]
fn the_pre_rename_mark_still_marks_a_program() {
    let mut program = HeaderMap::new();
    program.insert(LEGACY_CODE_EXECUTION_HEADER, "1".parse().unwrap());

    assert!(marks_code_execution(&program));
    assert!(is_agent_run(CredentialAttribution::Person, &program));
    assert!(is_program_run(CredentialAttribution::Person, &program));
    assert!(!marks_code_execution(&HeaderMap::new()));
}

/// The bootstrap marks every request a code step makes, owner routines' too,
/// so the header alone must not turn a signed owner step into an agent run.
/// Only a signed agent, or a header without any signed program attribution,
/// counts.
#[test]
fn a_signed_owner_routine_step_is_not_an_agent_run_even_with_the_header() {
    let mut program = HeaderMap::new();
    program.insert(CODE_EXECUTION_HEADER, "1".parse().unwrap());
    let browser = HeaderMap::new();

    assert!(
        !is_agent_run(CredentialAttribution::Routine, &program),
        "an owner routine code step (dangerously_operate_as_user)"
    );
    for headers in [&program, &browser] {
        assert!(
            is_agent_run(CredentialAttribution::Agent, headers),
            "an agent program, or a routine acting as its agent, header or not"
        );
    }
    // Still a program run: only a person may decide reviews and approvals.
    assert!(is_program_run(CredentialAttribution::Routine, &program));
}
