//! Events on a calendar Rox keeps itself, under a personal Rox mailbox.
//!
//! Nothing here calls a provider: the Postgres row is the record, so creation,
//! edits, and deletion are the same upsert and retirement paths a provider
//! echo takes, fed from the request instead of a response.
use super::*;
use crate::domain::events::CalendarEventMetadata;
use crate::domain::models::{
    CalendarEventSource, CalendarOccurrence, CalendarProvider, ConferenceChange,
    EventStatus, EventType, ProviderEventSource, ViewerCapabilities,
};
use crate::domain::ports::LocalEventTarget;

/// What a local calendar cannot express yet. Refused before anything is
/// written so the caller learns why instead of meeting a half-made event.
fn refuse_unsupported_local_fields(
    recurrence_lines: &[String],
    conference: Option<&ConferenceChange>,
    out_of_office: bool,
) -> Result<(), CalendarMutationError> {
    if !recurrence_lines.is_empty() {
        return Err(CalendarMutationError::InvalidInput(
            "a local calendar does not repeat events yet".to_string(),
        ));
    }
    if conference.is_some() {
        return Err(CalendarMutationError::InvalidInput(
            "a local calendar has no meeting service to attach".to_string(),
        ));
    }
    if out_of_office {
        return Err(CalendarMutationError::InvalidInput(
            "a local calendar does not carry out-of-office status".to_string(),
        ));
    }
    Ok(())
}

/// The source row a local event persists under: its own id doubles as the
/// provider-style identifier every source carries.
fn local_source(
    owner_email: &str,
    target: &LocalEventTarget,
    event_id: Uuid,
) -> CalendarEventSource {
    let _ = owner_email;
    CalendarEventSource::Local(ProviderEventSource {
        automatic_decline: None,
        binding: None,
        email_link_id: target.email_link_id,
        account_id: target.account_id,
        calendar_id: target.calendar_id,
        observed_access_role: target.observed_access_role.clone(),
        provider_event_id: target.provider_event_id.clone(),
        provider_recurring_event_id: None,
        provider_etag: None,
        raw_payload: serde_json::json!({ "id": event_id.to_string(), "local": true }),
    })
}

/// One materialized instance: a local event is never recurring, so it has
/// exactly the one its own time gives it.
fn local_occurrence(event_id: Uuid, time: EventTime) -> CalendarOccurrence {
    CalendarOccurrence {
        event_id,
        occurrence_key: time.occurrence_key(),
        recurrence_id: None,
        time,
        is_cancelled: false,
    }
}

fn local_attendees(inputs: Vec<CalendarAttendeeInput>) -> Vec<CalendarAttendee> {
    inputs
        .into_iter()
        .map(|input| CalendarAttendee {
            email: input.email.trim().to_lowercase(),
            display_name: None,
            response_status: input
                .response_status
                .unwrap_or(AttendeeResponseStatus::NeedsAction),
            is_organizer: false,
            is_optional: input.is_optional,
            is_self: false,
            comment: None,
        })
        .collect()
}

impl<R, G, T, B, N> CalendarMutationServiceImpl<R, G, T, B, N>
where
    R: CalendarRepository,
    G: CalendarMutationProvider,
    T: CalendarAccessTokenProvider,
    B: RoxEventBroker,
    N: CalendarRefreshNotifier,
{
    /// Store a new event on a local calendar and return it.
    pub(super) async fn create_local_event(
        &self,
        target: super::super::models::CalendarCreationTarget,
        draft: CalendarEventDraft,
    ) -> Result<CalendarEvent, CalendarMutationError> {
        refuse_unsupported_local_fields(
            &draft.recurrence_lines,
            draft.conference.as_ref(),
            draft.out_of_office.is_some(),
        )?;
        let event_id = Uuid::now_v7();
        let now = Utc::now();
        let event = CalendarEvent {
            id: event_id,
            owner_id: target.owner_id.clone(),
            ical_uid: format!("{event_id}@rox.one"),
            calendar_id: Some(target.calendar_id),
            sources: Vec::new(),
            title: draft.title,
            description: draft.description,
            location: draft.location,
            status: EventStatus::Confirmed,
            visibility: draft.visibility.unwrap_or_default(),
            transparency: draft.transparency.unwrap_or_default(),
            event_type: EventType::default(),
            time: draft.time.clone(),
            recurrence_lines: Vec::new(),
            organizer_email: Some(target.token_identity.email_address.clone()),
            organizer_name: None,
            creator_email: Some(target.token_identity.email_address.clone()),
            creator_name: None,
            conference_url: None,
            conference_provider: None,
            sequence: 0,
            is_read_only: false,
            attendees: local_attendees(draft.attendees),
            reminders: draft.reminders.unwrap_or_default(),
            guest_policy: draft.guest_policy.unwrap_or_default(),
            is_snapshot: false,
            viewer_can: ViewerCapabilities::NONE,
            created_at: now,
            updated_at: now,
        };
        let local_target = LocalEventTarget {
            event_id,
            owner_id: target.owner_id.clone(),
            email_link_id: target.email_link_id,
            account_id: target.account_id,
            calendar_id: target.calendar_id,
            provider_event_id: event_id.to_string(),
            is_read_only: false,
            observed_access_role: target.observed_access_role.clone(),
        };
        let upsert = CalendarEventUpsert {
            source: local_source(
                &target.token_identity.email_address,
                &local_target,
                event_id,
            ),
            occurrences: vec![local_occurrence(event_id, event.time.clone())],
            overrides: Vec::new(),
            event,
        };
        self.persist_echo(target.actor.as_ref(), upsert).await
    }

    /// Apply a patch to a stored local event and return the new state.
    pub(super) async fn update_local_event(
        &self,
        target: LocalEventTarget,
        patch: CalendarEventPatch,
        scope: CalendarUpdateScope,
    ) -> Result<CalendarEvent, CalendarMutationError> {
        if target.is_read_only {
            return Err(CalendarMutationError::ReadOnly);
        }
        // A local event has no series to scope a change to.
        if matches!(scope, CalendarUpdateScope::ThisEvent { .. }) {
            return Err(CalendarMutationError::OccurrenceNotFound);
        }
        refuse_unsupported_local_fields(
            patch.recurrence_lines.as_deref().unwrap_or_default(),
            patch.conference.as_ref(),
            patch.out_of_office.is_some(),
        )?;
        let mut event = self
            .repository
            .load_local_event(&target.owner_id, target.event_id)
            .await
            .map_err(internal)?
            .ok_or(CalendarMutationError::NotFound)?;
        if let Some(title) = patch.title {
            event.title = title;
        }
        if let Some(description) = patch.description {
            event.description = Some(description).filter(|value| !value.is_empty());
        }
        if let Some(location) = patch.location {
            event.location = Some(location).filter(|value| !value.is_empty());
        }
        if let Some(time) = patch.time {
            validate_time(&time)?;
            event.time = time;
        }
        if let Some(attendees) = patch.attendees {
            validate_attendee_emails(attendees.iter().map(|attendee| &attendee.email))?;
            event.attendees = local_attendees(attendees);
        }
        if let Some(visibility) = patch.visibility {
            event.visibility = visibility;
        }
        if let Some(transparency) = patch.transparency {
            event.transparency = transparency;
        }
        if let Some(reminders) = patch.reminders {
            validate_reminders(&reminders)?;
            event.reminders = reminders;
        }
        if let Some(guest_policy) = patch.guest_policy {
            event.guest_policy = guest_policy;
        }
        event.sequence = event.sequence.saturating_add(1);
        event.updated_at = Utc::now();
        event.viewer_can = ViewerCapabilities::NONE;
        let upsert = CalendarEventUpsert {
            source: local_source("", &target, event.id),
            occurrences: vec![local_occurrence(event.id, event.time.clone())],
            overrides: Vec::new(),
            event,
        };
        self.persist_echo(None, upsert).await
    }

    /// Remove a local event from Postgres and tell its viewers.
    pub(super) async fn delete_local_event(
        &self,
        target: &LocalEventTarget,
    ) -> Result<(), CalendarMutationError> {
        if target.is_read_only {
            return Err(CalendarMutationError::ReadOnly);
        }
        let deleted = self
            .repository
            .delete_local_event(&target.owner_id, target.event_id)
            .await
            .map_err(|error| CalendarMutationError::PersistFailed(format!("{error:?}")))?;
        if !deleted {
            return Err(CalendarMutationError::NotFound);
        }
        self.publish_calendar_event(CalendarTopicEvent::Deleted(CalendarEventMetadata {
            event_id: target.event_id,
            owner_id: target.owner_id.clone(),
        }));
        self.refresh
            .calendar_changed(&target.owner_id, target.email_link_id, false)
            .await;
        Ok(())
    }
}

/// Whether a provider is the one Rox keeps itself.
pub(super) fn is_local(provider: CalendarProvider) -> bool {
    provider.is_local()
}
