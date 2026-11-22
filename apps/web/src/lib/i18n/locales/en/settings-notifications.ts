export default {
  groups: {
    sharing: 'Sharing',
    channels: 'Channels',
    documents: 'Documents',
    projects: 'Projects',
    crm: 'Companies & contacts',
    tasks: 'Tasks',
    calendar: 'Calendar',
    passwords: 'Passwords',
    email: 'Email',
    ai: 'AI',
    github: 'GitHub',
  },
  events: {
    entity_access_requested: {
      label: 'Permission requests',
      description: 'Requests for more access to items you manage',
    },
    entity_access_granted: {
      label: 'Access granted',
      description: 'When a permission request is approved',
    },
    channel_message_send: {
      label: 'New messages',
      description: 'Messages in channels you belong to',
    },
    channel_mention: {
      label: 'Mentions',
      description: 'When someone mentions you in a channel',
    },
    channel_message_reply: {
      label: 'Thread replies',
      description: 'Replies in threads you are part of',
    },
    channel_message_reaction: {
      label: 'Message reactions',
      description: 'When someone reacts to one of your messages',
    },
    channel_access_requested: {
      label: 'Requests to join',
      description: 'When someone asks to join a channel you belong to',
    },
    document_mention: {
      label: 'Document mentions',
      description: 'When a document is mentioned in a channel',
    },
    mentioned_in_document_comment: {
      label: 'Comment mentions',
      description: 'When you are mentioned in a document comment',
    },
    replied_to_document_comment_thread: {
      label: 'Comment replies',
      description: 'Replies on comment threads you are part of',
    },
    commented_on_document: {
      label: 'New comments',
      description: 'Comments on documents you own',
    },
    initiative_discussion: {
      label: 'Discussion',
      description:
        'Mentions, replies, and comments on projects you own or are assigned to',
    },
    crm_discussion: {
      label: 'Discussion',
      description:
        'Mentions, replies, and comments on companies you own and their contacts',
    },
    task_assigned: {
      label: 'Assignments',
      description: 'When a task is assigned to you',
    },
    calendar_event_reminder: {
      label: 'Event reminders',
      description: 'When a calendar event is about to start',
    },
    calendar_event_join_request: {
      label: 'Requests to join',
      description:
        'When someone asks to be added to an event you shared in a channel',
    },
    password_access_requested: {
      label: 'Agent access requests',
      description: 'When an agent asks to use a password item you manage',
    },
    new_email: {
      label: 'New email',
      description: 'When a new email arrives',
    },
    ai_response: {
      label: 'AI replies',
      description: 'When an AI chat responds',
    },
    agent_session_settled: {
      label: 'Agent finished',
      description: 'When an agent session you took part in finishes a turn',
    },
    agent_session_waiting_for_input: {
      label: 'Agent needs an answer',
      description: 'When your agent stops to ask you something',
    },
    agent_session_mentioned: {
      label: 'Agent session mentions',
      description: 'When someone mentions you in an agent session',
    },
    routine_run_finished: {
      label: 'Routine runs',
      description: 'When one of your routines finishes or fails a run',
    },
    agent_sign_in_expiry: {
      label: 'Computer agent sign-ins',
      description:
        'When an agent sign-in on your team’s computer is about to expire',
    },
    computer_setup: {
      label: 'Computer setup',
      description:
        'When a computer you bought is ready, or could not be set up',
    },
    github_pr_status_changed: {
      label: 'PR status',
      description: 'When a pull request changes lifecycle state',
    },
    github_review_requested: {
      label: 'Review requested',
      description: 'When your review is requested',
    },
    github_pr_comment: {
      label: 'PR comments',
      description: 'When someone comments on a pull request',
    },
    github_pr_mention: {
      label: 'PR mentions',
      description: 'When you are mentioned on a pull request',
    },
    github_pr_review: {
      label: 'PR reviews',
      description: 'When a review is submitted on your pull request',
    },
  },
  notifyForAll: 'Notify for all',
  resume: 'Resume',
  unmute: 'Unmute',
  until: 'Until {{date}}',
  changeTime: 'Change time',
  snoozeInstead: 'Snooze instead',
  snoozeFor30Min: 'For 30 minutes',
  snoozeFor1Hour: 'For 1 hour',
  snoozeFor3Hours: 'For 3 hours',
  snoozeUntilMorning: 'Until the morning',
  snoozeForWeekend: 'For the weekend',
  snoozeUntilMonday: 'Until Monday',
  snoozeForWeek: 'For a week',
  snoozedToast: {
    one: 'Snoozed {{count}} item until {{date}}',
    other: 'Snoozed {{count}} items until {{date}}',
  },
  snoozeUntil: 'Snooze until',
  snoozePlaceholder: 'Choose a time, or type tomorrow 10am…',
  snoozeTitle: 'Snooze notifications',
  snoozeTitleCount: 'Snooze notifications for {{count}} items',
  snoozeDescription:
    'Notifications resume automatically. Times are in your local time zone.',
  snoozeEmpty: 'Enter a future time, like 2h or tomorrow 10am.',
  snoozeKeyHint: '↑ ↓ to choose · Enter to snooze · Esc to cancel',
  snoozeTapHint: 'Tap a time to snooze',
  snoozing: 'Snoozing…',
  types: {
    calendar_event: 'Calendar event',
    call: 'Call',
    channel: 'Channel',
    channel_message: 'Thread',
    chat: 'Chat',
    document: 'Document',
    email: 'Email',
    email_thread: 'Email',
    foreign: 'GitHub',
    foreign_entity: 'GitHub',
    project: 'Folder',
    initiative: 'Project',
    crm_company: 'Company',
    crm_contact: 'Contact',
    reminder: 'Reminder',
    team: 'Team',
  },
};
