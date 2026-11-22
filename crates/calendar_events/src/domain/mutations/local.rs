//! Events a Rox-owned calendar keeps inside Rox.
//!
//! A personal calendar created from the interface has no Gmail or Microsoft
//! grant behind it: there is no provider to write through, so the event the
//! person creates is the event Rox stores. The projection built here has the
//! same shape as a provider echo, which is what lets every read path — the
//! week grid, the agenda, reminders — see it without a second pipeline.

use chrono::{DateTime, Utc};
use uuid::Uuid;

use super::CalendarMutationError;
use crate::domain::models::{
    AttendeeResponseStatus, CalendarAttendee, CalendarCreationTarget, CalendarEvent,
    CalendarEventDraft, CalendarEventSource, CalendarEventUpsert, CalendarOccurrence, EventStatus,
    EventType, ProviderEventSource, ViewerCapabilities, creation_provider_id,
};

/// Domain the identifiers of Rox-kept events are minted under, so an
/// iCalendar export of one reads as a Rox event rather than a provider one.
const ROX_EVENT_UID_DOMAIN: &str = "rox.one";

/// Build the projection of a newly created event on a Rox-owned calendar.
///
/// The draft was already validated by the caller. Recurrence is refused here
/// because Rox stores no recurrence expansion of its own yet, and writing a
/// rule without its instances would show a series that never repeats.
pub(super) fn created_event(
    target: &CalendarCreationTarget,
    draft: &CalendarEventDraft,
    now: DateTime<Utc>,
) -> Result<CalendarEventUpsert, CalendarMutationError> {
    if !draft.recurrence_lines.is_empty() {
        return Err(CalendarMutationError::InvalidInput(
            "repeating events are not supported on a Rox calendar yet".to_string(),
        ));
    }
    let event_id = Uuid::now_v7();
    // A retry that carries its creation key must land on the same rows, so the
    // provider identifier — and through it the iCalendar UID the upsert keys
    // on — is derived from the key rather than from this attempt.
    let provider_event_id = draft
        .idempotency_key
        .map(|key| creation_provider_id(key, &target.owner_id))
        .unwrap_or_else(|| event_id.simple().to_string());
    let ical_uid = format!("{provider_event_id}@{ROX_EVENT_UID_DOMAIN}");
    let occurrence_key = draft.time.occurrence_key();
    let email_address = target.token_identity.email_address.clone();

    let event = CalendarEvent {
        id: event_id,
        owner_id: target.owner_id.clone(),
        ical_uid,
        calendar_id: Some(target.calendar_id),
        sources: Vec::new(),
        title: draft.title.clone(),
        description: non_empty(draft.description.as_deref()),
        location: non_empty(draft.location.as_deref()),
        status: EventStatus::Confirmed,
        visibility: draft.visibility.unwrap_or_default(),
        transparency: draft.transparency.unwrap_or_default(),
        event_type: EventType::default(),
        time: draft.time.clone(),
        recurrence_lines: Vec::new(),
        organizer_email: Some(email_address.clone()),
        organizer_name: None,
        creator_email: Some(email_address.clone()),
        creator_name: None,
        conference_url: None,
        conference_provider: None,
        sequence: 0,
        is_read_only: false,
        attendees: draft
            .attendees
            .iter()
            .map(|attendee| CalendarAttendee {
                email: attendee.email.clone(),
                display_name: None,
                response_status: attendee
                    .response_status
                    .unwrap_or(AttendeeResponseStatus::NeedsAction),
                is_organizer: attendee.email.eq_ignore_ascii_case(&email_address),
                is_optional: attendee.is_optional,
                is_self: false,
                comment: None,
            })
            .collect(),
        reminders: draft.reminders.clone().unwrap_or_default(),
        guest_policy: draft.guest_policy.unwrap_or_default(),
        is_snapshot: false,
        viewer_can: ViewerCapabilities::NONE,
        created_at: now,
        updated_at: now,
    };

    let source = CalendarEventSource::Google(ProviderEventSource {
        automatic_decline: None,
        // No grant authorizes this write: Rox itself does, which is what
        // `CalendarCreationTarget::is_local` said when the target was chosen.
        binding: None,
        email_link_id: target.email_link_id,
        account_id: target.account_id,
        calendar_id: target.calendar_id,
        observed_access_role: Some("owner".to_string()),
        provider_event_id,
        provider_recurring_event_id: None,
        provider_etag: None,
        raw_payload: serde_json::json!({ "provider": "rox" }),
    });

    let occurrences = vec![CalendarOccurrence {
        event_id,
        occurrence_key,
        recurrence_id: None,
        time: draft.time.clone(),
        is_cancelled: false,
    }];

    Ok(CalendarEventUpsert {
        event,
        source,
        overrides: Vec::new(),
        occurrences,
    })
}

/// An empty text field means "no value", as it does on the provider paths.
fn non_empty(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}
