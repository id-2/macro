import { t, type TranslationKey } from '@app/lib/i18n';

/**
 * Event types the notification service lets a user disable.
 * Keep this list aligned with `BLOCKABLE_NOTIFICATIONS` in
 * `services/notification_service/src/api/user_notification.rs`.
 * `email-digest-notification` is a delivery control, not an inbox event.
 */

export const EMAIL_DIGEST_NOTIFICATION_TYPE =
  'email-digest-notification' as const;

export type NotificationEventGroupId =
  | 'channels'
  | 'projects'
  | 'documents'
  | 'sharing'
  | 'crm'
  | 'tasks'
  | 'calendar'
  | 'passwords'
  | 'email'
  | 'ai'
  | 'github';

export type NotificationEventDefinition = {
  type: string;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  /** Shown only with `enable-macro-computers` on. */
  macroComputers?: true;
};

export type NotificationEventGroup = {
  id: NotificationEventGroupId;
  labelKey: TranslationKey;
  events: readonly NotificationEventDefinition[];
};

export const NOTIFICATION_EVENT_GROUPS: readonly NotificationEventGroup[] = [
  {
    id: 'sharing',
    labelKey: 'settingsNotifications.groups.sharing',
    events: [
      {
        type: 'entity_access_requested',
        labelKey: 'settingsNotifications.events.entity_access_requested.label',
        descriptionKey: 'settingsNotifications.events.entity_access_requested.description',
      },
      {
        type: 'entity_access_granted',
        labelKey: 'settingsNotifications.events.entity_access_granted.label',
        descriptionKey: 'settingsNotifications.events.entity_access_granted.description',
      },
    ],
  },
  {
    id: 'channels',
    labelKey: 'settingsNotifications.groups.channels',
    events: [
      {
        type: 'channel_message_send',
        labelKey: 'settingsNotifications.events.channel_message_send.label',
        descriptionKey: 'settingsNotifications.events.channel_message_send.description',
      },
      {
        type: 'channel_mention',
        labelKey: 'settingsNotifications.events.channel_mention.label',
        descriptionKey: 'settingsNotifications.events.channel_mention.description',
      },
      {
        type: 'channel_message_reply',
        labelKey: 'settingsNotifications.events.channel_message_reply.label',
        descriptionKey: 'settingsNotifications.events.channel_message_reply.description',
      },
      {
        type: 'channel_message_reaction',
        labelKey: 'settingsNotifications.events.channel_message_reaction.label',
        descriptionKey: 'settingsNotifications.events.channel_message_reaction.description',
      },
      {
        type: 'channel_access_requested',
        labelKey: 'settingsNotifications.events.channel_access_requested.label',
        descriptionKey: 'settingsNotifications.events.channel_access_requested.description',
      },
    ],
  },
  {
    id: 'documents',
    labelKey: 'settingsNotifications.groups.documents',
    events: [
      {
        type: 'document_mention',
        labelKey: 'settingsNotifications.events.document_mention.label',
        descriptionKey: 'settingsNotifications.events.document_mention.description',
      },
      {
        type: 'mentioned_in_document_comment',
        labelKey: 'settingsNotifications.events.mentioned_in_document_comment.label',
        descriptionKey: 'settingsNotifications.events.mentioned_in_document_comment.description',
      },
      {
        type: 'replied_to_document_comment_thread',
        labelKey: 'settingsNotifications.events.replied_to_document_comment_thread.label',
        descriptionKey: 'settingsNotifications.events.replied_to_document_comment_thread.description',
      },
      {
        type: 'commented_on_document',
        labelKey: 'settingsNotifications.events.commented_on_document.label',
        descriptionKey: 'settingsNotifications.events.commented_on_document.description',
      },
    ],
  },
  {
    id: 'projects',
    labelKey: 'settingsNotifications.groups.projects',
    events: [
      {
        type: 'initiative_discussion',
        labelKey: 'settingsNotifications.events.initiative_discussion.label',
        descriptionKey: 'settingsNotifications.events.initiative_discussion.description',
      },
    ],
  },
  {
    id: 'crm',
    labelKey: 'settingsNotifications.groups.crm',
    events: [
      {
        type: 'crm_discussion',
        labelKey: 'settingsNotifications.events.crm_discussion.label',
        descriptionKey: 'settingsNotifications.events.crm_discussion.description',
      },
    ],
  },
  {
    id: 'tasks',
    labelKey: 'settingsNotifications.groups.tasks',
    events: [
      {
        type: 'task_assigned',
        labelKey: 'settingsNotifications.events.task_assigned.label',
        descriptionKey: 'settingsNotifications.events.task_assigned.description',
      },
    ],
  },
  {
    id: 'calendar',
    labelKey: 'settingsNotifications.groups.calendar',
    events: [
      {
        type: 'calendar_event_reminder',
        labelKey: 'settingsNotifications.events.calendar_event_reminder.label',
        descriptionKey: 'settingsNotifications.events.calendar_event_reminder.description',
      },
      {
        type: 'calendar_event_join_request',
        labelKey: 'settingsNotifications.events.calendar_event_join_request.label',
        descriptionKey: 'settingsNotifications.events.calendar_event_join_request.description',
      },
    ],
  },
  {
    id: 'passwords',
    labelKey: 'settingsNotifications.groups.passwords',
    events: [
      {
        type: 'password_access_requested',
        labelKey: 'settingsNotifications.events.password_access_requested.label',
        descriptionKey: 'settingsNotifications.events.password_access_requested.description',
      },
    ],
  },
  {
    id: 'email',
    labelKey: 'settingsNotifications.groups.email',
    events: [
      {
        type: 'new_email',
        labelKey: 'settingsNotifications.events.new_email.label',
        descriptionKey: 'settingsNotifications.events.new_email.description',
      },
    ],
  },
  {
    id: 'ai',
    labelKey: 'settingsNotifications.groups.ai',
    events: [
      {
        type: 'ai_response',
        labelKey: 'settingsNotifications.events.ai_response.label',
        descriptionKey: 'settingsNotifications.events.ai_response.description',
      },
      {
        type: 'agent_session_settled',
        labelKey: 'settingsNotifications.events.agent_session_settled.label',
        descriptionKey: 'settingsNotifications.events.agent_session_settled.description',
      },
      {
        type: 'agent_session_waiting_for_input',
        labelKey: 'settingsNotifications.events.agent_session_waiting_for_input.label',
        descriptionKey: 'settingsNotifications.events.agent_session_waiting_for_input.description',
      },
      {
        type: 'agent_session_mentioned',
        labelKey: 'settingsNotifications.events.agent_session_mentioned.label',
        descriptionKey: 'settingsNotifications.events.agent_session_mentioned.description',
      },
      {
        type: 'routine_run_finished',
        labelKey: 'settingsNotifications.events.routine_run_finished.label',
        descriptionKey: 'settingsNotifications.events.routine_run_finished.description',
      },
      {
        type: 'agent_sign_in_expiry',
        labelKey: 'settingsNotifications.events.agent_sign_in_expiry.label',
        descriptionKey: 'settingsNotifications.events.agent_sign_in_expiry.description',
        macroComputers: true,
      },
      {
        type: 'computer_setup',
        labelKey: 'settingsNotifications.events.computer_setup.label',
        descriptionKey: 'settingsNotifications.events.computer_setup.description',
        macroComputers: true,
      },
    ],
  },
  {
    id: 'github',
    labelKey: 'settingsNotifications.groups.github',
    events: [
      {
        type: 'github_pr_status_changed',
        labelKey: 'settingsNotifications.events.github_pr_status_changed.label',
        descriptionKey: 'settingsNotifications.events.github_pr_status_changed.description',
      },
      {
        type: 'github_review_requested',
        labelKey: 'settingsNotifications.events.github_review_requested.label',
        descriptionKey: 'settingsNotifications.events.github_review_requested.description',
      },
      {
        type: 'github_pr_comment',
        labelKey: 'settingsNotifications.events.github_pr_comment.label',
        descriptionKey: 'settingsNotifications.events.github_pr_comment.description',
      },
      {
        type: 'github_pr_mention',
        labelKey: 'settingsNotifications.events.github_pr_mention.label',
        descriptionKey: 'settingsNotifications.events.github_pr_mention.description',
      },
      {
        type: 'github_pr_review',
        labelKey: 'settingsNotifications.events.github_pr_review.label',
        descriptionKey: 'settingsNotifications.events.github_pr_review.description',
      },
    ],
  },
];

export const BLOCKABLE_NOTIFICATION_EVENT_TYPES: readonly string[] =
  NOTIFICATION_EVENT_GROUPS.flatMap((group) =>
    group.events.map((event) => event.type)
  );

export const MUTED_ENTITY_TYPE_LABELS: Record<string, TranslationKey> = {
  calendar_event: 'settingsNotifications.types.calendar_event',
  call: 'settingsNotifications.types.call',
  channel: 'settingsNotifications.types.channel',
  channel_message: 'settingsNotifications.types.channel_message',
  chat: 'settingsNotifications.types.chat',
  document: 'settingsNotifications.types.document',
  email: 'settingsNotifications.types.email',
  email_thread: 'settingsNotifications.types.email_thread',
  foreign: 'settingsNotifications.types.foreign',
  foreign_entity: 'settingsNotifications.types.foreign_entity',
  project: 'settingsNotifications.types.project',
  initiative: 'settingsNotifications.types.initiative',
  crm_company: 'settingsNotifications.types.crm_company',
  crm_contact: 'settingsNotifications.types.crm_contact',
  reminder: 'settingsNotifications.types.reminder',
  team: 'settingsNotifications.types.team',
};

export function mutedEntityTypeLabel(itemType: string): string {
  const key = MUTED_ENTITY_TYPE_LABELS[itemType];
  return key ? t(key) : itemType.replace(/_/g, ' ');
}
