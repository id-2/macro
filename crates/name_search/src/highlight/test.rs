use super::highlight_name;

#[test]
fn returns_none_for_empty_term() {
    assert!(highlight_name("testingfoop", "").is_none());
    assert!(highlight_name("testingfoop", "   ").is_none());
}

#[test]
fn returns_none_when_name_does_not_match() {
    assert!(highlight_name("unrelated", "test").is_none());
}

#[test]
fn wraps_substring_matches_case_insensitively() {
    assert_eq!(
        highlight_name("testingfoop", "test").as_deref(),
        Some("<rox_em>test</rox_em>ingfoop")
    );
    assert_eq!(
        highlight_name("MD CHECKBOX LIST TEST", "test").as_deref(),
        Some("MD CHECKBOX LIST <rox_em>TEST</rox_em>")
    );
}

#[test]
fn wraps_all_occurrences() {
    assert_eq!(
        highlight_name("test of a test", "test").as_deref(),
        Some("<rox_em>test</rox_em> of a <rox_em>test</rox_em>")
    );
}

#[test]
fn escapes_regex_specials_in_term() {
    assert_eq!(
        highlight_name("plan (v2) draft", "(v2)").as_deref(),
        Some("plan <rox_em>(v2)</rox_em> draft")
    );
}

#[test]
fn highlights_every_term_of_a_multi_term_query() {
    assert_eq!(
        super::highlight_name_terms("Peter Chinman, Teo Nys", &["peter", "teo"]).as_deref(),
        Some("<rox_em>Peter</rox_em> Chinman, <rox_em>Teo</rox_em> Nys")
    );
}

#[test]
fn merges_overlapping_term_matches_into_one_span() {
    assert_eq!(
        super::highlight_name_terms("Rox Planning", &["plan", "lann"]).as_deref(),
        Some("Macro <rox_em>Plann</rox_em>ing")
    );
}

#[test]
fn returns_none_when_no_term_matches() {
    assert!(super::highlight_name_terms("Rox Planning", &["teo", " "]).is_none());
}
