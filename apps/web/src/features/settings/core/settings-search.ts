import { t } from '@app/lib/i18n';
import type { SettingsTab } from '@core/constant/SettingsState';
import type {
  SettingsTabGroup,
  SettingsTabItem,
} from '@core/constant/settingsTabsConfig';
import { NOTIFICATION_EVENT_GROUPS } from '../../notifications/notification-event-catalog';
import { settingsTarget } from './settings-target';

type Setting = {
  id: string;
  tab: SettingsTab;
  title: string;
  target?: string;
  keywords: string;
  /** Listed only with `enable-macro-computers` on. */
  macroComputers?: true;
};
export type SettingsSearchResult = Setting & {
  id: string;
  page: SettingsTabItem;
  /** The nav group holding the page, so `General` reads as `Team · General`. */
  group: string;
};

/** Notification rows, named as the Notifications page renders them. */
function notificationSettings(): Setting[] {
  return NOTIFICATION_EVENT_GROUPS.flatMap((group) =>
    group.events.map((event) => {
      const groupLabel = t(group.labelKey);
      return {
        id: event.type,
        tab: 'Notifications' as const,
        title: `${t(event.labelKey)} · ${groupLabel}`,
        target: groupLabel,
        keywords: `${groupLabel} ${t(event.descriptionKey)}`,
        macroComputers: event.macroComputers,
      };
    })
  );
}

// Targets are the visible SettingsSection/SettingsRow labels, not DOM selectors.
// Keep individual controls here so finding a setting doesn't require its page name.
/** The catalog, named as the screens render their sections. */
function settingsCatalog(): Setting[] {
  return [
  {
    tab: 'CRM',
    id: 'stages',
    title: t('settingsSearch.stagesTitle'),
    target: t('settingsSearch.stagesTarget'),
    keywords: 'company deal pipeline reorder rename status sales',
  },
  {
    tab: 'CRM',
    id: 'teamCrm',
    title: t('settingsSearch.teamCrmTitle'),
    target: t('settingsSearch.teamCrmTarget'),
    keywords: 'enable disable customers contacts companies team',
  },
  {
    tab: 'Shortcuts',
    id: 'commandShortcuts',
    title: t('settingsSearch.commandShortcutsTitle'),
    target: t('settingsSearch.commandShortcutsTarget'),
    keywords: 'keyboard hotkeys find create settings chat',
  },
  {
    tab: 'Shortcuts',
    id: 'splitShortcuts',
    title: t('settingsSearch.splitShortcutsTitle'),
    target: t('settingsSearch.splitShortcutsTarget'),
    keywords: 'keyboard hotkeys back forward panel close',
  },
  {
    tab: 'Shortcuts',
    id: 'listShortcuts',
    title: t('settingsSearch.listShortcutsTitle'),
    target: t('settingsSearch.listShortcutsTarget'),
    keywords: 'keyboard hotkeys select read unread delete preview',
  },
  {
    tab: 'Email',
    id: 'emailAccounts',
    title: t('settingsSearch.emailAccountsTitle'),
    target: t('settingsSearch.emailAccountsTarget'),
    keywords: 'gmail connect add inbox sync reconnect remove',
  },
  {
    tab: 'Email',
    id: 'emailRowStyle',
    title: t('settingsSearch.emailRowStyleTitle'),
    target: t('settingsSearch.emailRowStyleTarget'),
    keywords:
      'display options minimalist classic list rows unread bold divider checkbox density',
  },
  {
    tab: 'Email',
    id: 'emailSignatures',
    title: t('settingsSearch.emailSignaturesTitle'),
    target: t('settingsSearch.emailSignaturesTarget'),
    keywords: 'signature footer signoff formatting image replies forwards',
  },
  {
    tab: 'Calendar',
    id: 'connectedCalendars',
    title: t('settingsSearch.connectedCalendarsTitle'),
    target: t('settingsSearch.connectedCalendarsTarget'),
    keywords:
      'google gmail connect accounts visibility show hide color colour subcalendar',
  },
  {
    tab: 'Calendar',
    id: 'nextMeeting',
    title: t('settingsSearch.nextMeetingTitle'),
    target: t('settingsSearch.nextMeetingTarget'),
    keywords: 'sidebar badge upcoming meeting minutes now timer hide',
  },
  {
    tab: 'Agents',
    id: 'teamAgents',
    title: t('settingsSearch.teamAgentsTitle'),
    target: t('settingsSearch.teamAgentsTarget'),
    keywords: 'shared ai assistant configure',
  },
  {
    tab: 'Agents',
    id: 'privateAgents',
    title: t('settingsSearch.privateAgentsTitle'),
    target: t('settingsSearch.privateAgentsTarget'),
    keywords: 'personal ai assistant configure',
  },
  {
    tab: 'Harness',
    id: 'agentMachines',
    title: t('settingsSearch.agentMachinesTitle'),
    keywords:
      'cursor harness runtime machine computer api key provider pairing daemon',
  },
  {
    tab: 'Harness',
    id: 'localAgents',
    title: t('settingsSearch.localAgentsTitle'),
    keywords:
      'local runtime roxd this computer machine claude code codex desktop daemon',
  },
  {
    tab: 'Account',
    id: 'profilePicture',
    title: t('settingsSearch.profilePictureTitle'),
    target: t('settingsSearch.profilePictureTarget'),
    keywords: 'avatar photo image',
  },
  {
    tab: 'Account',
    id: 'nameAndEmail',
    title: t('settingsSearch.nameAndEmailTitle'),
    target: t('settingsSearch.nameAndEmailTarget'),
    keywords: 'first last profile account',
  },
  {
    tab: 'Account',
    id: 'deleteAccount',
    title: t('settingsSearch.deleteAccountTitle'),
    target: t('settingsSearch.deleteAccountTarget'),
    keywords: 'remove close deletion',
  },
  {
    tab: 'Appearance',
    id: 'colorTheme',
    title: t('settingsSearch.colorThemeTitle'),
    target: t('settingsSearch.colorThemeTarget'),
    keywords: 'dark light system mode custom colour',
  },
  {
    tab: 'Appearance',
    id: 'monochromeIcons',
    title: t('settingsSearch.monochromeIconsTitle'),
    target: t('settingsSearch.monochromeIconsTarget'),
    keywords: 'color colourful sidebar',
  },
  {
    tab: 'Appearance',
    id: 'interfaceLanguage',
    title: t('settingsSearch.interfaceLanguageTitle'),
    target: t('settingsSearch.interfaceLanguageTarget'),
    // The word for "language" in each interface language, so people can find
    // it in their own.
    keywords:
      'translate translation locale team personal sprache langue idioma lingua taal språk sprog kieli język язык 言語 언어 语言 語言 भाषा bahasa ngôn ngữ ภาษา',
  },
  {
    tab: 'Appearance',
    id: 'showTooltips',
    title: t('settingsSearch.showTooltipsTitle'),
    target: t('settingsSearch.showTooltipsTarget'),
    keywords: 'hover hints help',
  },
  {
    tab: 'Notifications',
    id: 'notificationDelivery',
    title: t('settingsSearch.notificationDeliveryTitle'),
    target: t('settingsSearch.notificationDeliveryTarget'),
    keywords: 'push desktop browser mobile alerts permissions',
  },
  {
    tab: 'Notifications',
    id: 'emailDigest',
    title: t('settingsSearch.emailDigestTitle'),
    target: t('settingsSearch.emailDigestTarget'),
    keywords: 'summary notification daily mail',
  },
  {
    tab: 'Notifications',
    id: 'quietHours',
    title: t('settingsSearch.quietHoursTitle'),
    target: t('settingsSearch.quietHoursTarget'),
    keywords: 'schedule do not disturb dnd silence mute night timezone',
  },
  {
    tab: 'Notifications',
    id: 'snoozedItems',
    title: t('settingsSearch.snoozedItemsTitle'),
    target: t('settingsSearch.snoozedItemsTarget'),
    keywords: 'pause resume notifications',
  },
  {
    tab: 'Notifications',
    id: 'mutedItems',
    title: t('settingsSearch.mutedItemsTitle'),
    target: t('settingsSearch.mutedItemsTarget'),
    keywords: 'unmute silence notifications',
  },
  {
    tab: 'Billing',
    id: 'planAndPayment',
    title: t('settingsSearch.planAndPaymentTitle'),
    target: t('settingsSearch.planAndPaymentTarget'),
    keywords: 'subscription invoice billing credit card cancel manage upgrade',
  },
  {
    tab: 'Billing',
    id: 'aiUsage',
    title: t('settingsSearch.aiUsageTitle'),
    target: t('settingsSearch.aiUsageTarget'),
    keywords: 'limits quota tokens credits consumption',
  },
  {
    tab: 'Team',
    id: 'teamName',
    title: t('settingsSearch.teamNameTitle'),
    target: t('settingsSearch.teamNameTarget'),
    keywords: 'workspace slug rename',
  },
  {
    tab: 'Team Members',
    id: 'invitePeople',
    title: t('settingsSearch.invitePeopleTitle'),
    keywords: 'invite add teammates coworkers colleagues email join team',
  },
  {
    tab: 'Team Members',
    id: 'memberRoles',
    title: t('settingsSearch.memberRolesTitle'),
    keywords: 'admin owner permissions remove users team',
  },
  {
    tab: 'Team Members',
    id: 'pendingInvites',
    title: t('settingsSearch.pendingInvitesTitle'),
    target: t('settingsSearch.pendingInvitesTarget'),
    keywords: 'invitations cancel resend copy link team',
  },
  {
    tab: 'Team Members',
    id: 'autoJoinDomain',
    title: t('settingsSearch.autoJoinDomainTitle'),
    target: t('settingsSearch.autoJoinDomainTarget'),
    keywords: 'email workspace membership automatic',
  },
  {
    tab: 'Team Members',
    id: 'membersCanInvite',
    title: t('settingsSearch.membersCanInviteTitle'),
    target: t('settingsSearch.membersCanInviteTarget'),
    keywords: 'permissions invitation',
  },
  {
    tab: 'Team',
    id: 'defaultLinkSharing',
    title: t('settingsSearch.defaultLinkSharingTitle'),
    target: t('settingsSearch.defaultLinkSharingTarget'),
    keywords: 'access public private permission',
  },
  {
    tab: 'Tags',
    id: 'personalTags',
    title: t('settingsSearch.personalTagsTitle'),
    target: t('settingsSearch.personalTagsTarget'),
    keywords: 'label organize category',
  },
  {
    tab: 'Tags',
    id: 'teamTags',
    title: t('settingsSearch.teamTagsTitle'),
    target: t('settingsSearch.teamTagsTarget'),
    keywords: 'shared label workspace category',
  },
  {
    tab: 'Connected',
    id: 'gmail',
    title: t('settingsSearch.gmailTitle'),
    target: t('settingsSearch.gmailTarget'),
    keywords: 'email google workspace inbox calendar connect account',
  },
  {
    tab: 'Connected',
    id: 'outlook',
    title: t('settingsSearch.outlookTitle'),
    target: t('settingsSearch.outlookTarget'),
    keywords: 'email microsoft 365 inbox calendar connect account',
  },
  {
    tab: 'Connected',
    id: 'github',
    title: t('settingsSearch.githubTitle'),
    target: t('settingsSearch.githubTarget'),
    keywords:
      'connect integration repository pull request code app install team',
  },
  {
    tab: 'Connected',
    id: 'slack',
    title: t('settingsSearch.slackTitle'),
    target: t('settingsSearch.slackTarget'),
    keywords: 'chat messages channels agent tools mcp connect',
  },
  {
    tab: 'Connected',
    id: 'importSlack',
    title: t('settingsSearch.importSlackTitle'),
    target: t('settingsSearch.importSlackTarget'),
    keywords: 'slack export channels messages history team',
  },
  {
    tab: 'Connected',
    id: 'linear',
    title: t('settingsSearch.linearTitle'),
    target: t('settingsSearch.linearTarget'),
    keywords: 'issues tasks projects agent tools mcp connect import',
  },
  {
    tab: 'Connected',
    id: 'notion',
    title: t('settingsSearch.notionTitle'),
    target: t('settingsSearch.notionTarget'),
    keywords: 'pages wikis docs agent tools mcp connect import',
  },
  {
    tab: 'Connected',
    id: 'granola',
    title: t('settingsSearch.granolaTitle'),
    target: t('settingsSearch.granolaTarget'),
    keywords: 'meetings notes transcripts calls import',
  },
  {
    tab: 'Connected',
    id: 'aiApps',
    title: t('settingsSearch.aiAppsTitle'),
    target: t('settingsSearch.aiAppsTarget'),
    keywords: 'ai apps mcp ide setup',
  },
  {
    tab: 'Connected',
    id: 'codingAgents',
    title: t('settingsSearch.codingAgentsTitle'),
    target: t('settingsSearch.codingAgentsTarget'),
    keywords: 'local harness hermes openclaw desktop stream sessions',
  },
  {
    tab: 'Connected',
    id: 'customMcp',
    title: t('settingsSearch.customMcpTitle'),
    keywords: 'add mcp server url integration',
  },
  {
    tab: 'Connected',
    id: 'agentApps',
    title: t('settingsSearch.agentAppsTitle'),
    keywords:
      'mcp integration connect external services catalog airtable trello jira asana google drive dropbox',
  },
  {
    tab: 'Agent',
    id: 'connectMcp',
    title: t('settingsSearch.connectMcpTitle'),
    keywords: 'claude chatgpt external client url setup',
  },
  {
    tab: 'API Keys',
    id: 'apiKeys',
    title: t('settingsSearch.apiKeysTitle'),
    keywords: 'token secret developer authentication',
  },
  {
    tab: 'Account Managers',
    id: 'accountManagers',
    title: t('settingsSearch.accountManagersTitle'),
    keywords: 'agent manager token access revoke',
  },
  {
    tab: 'Desktop App',
    id: 'desktopApp',
    title: t('settingsSearch.desktopAppTitle'),
    keywords: 'download mac macos linux version latest release updated',
  },
  {
    tab: 'Mobile App',
    id: 'mobileApp',
    title: t('settingsSearch.mobileAppTitle'),
    keywords: 'download phone ios android qr code version build bundle',
  },
  ...notificationSettings(),
  ];
}

/**
 * Lowercased words with Latin accents stripped. Any script counts, so a label
 * in the interface language (German, Japanese, Hindi) is searchable too.
 */
function words(value: string): string[] {
  return (
    value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .match(/[\p{L}\p{M}\p{N}]+/gu) ?? []
  );
}

/** One insertion, deletion, substitution, or adjacent transposition. */
function isNearWord(a: string, b: string): boolean {
  if (a.length < 4 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  if (a.length === b.length) {
    return (
      a.slice(i + 1) === b.slice(i + 1) ||
      (a[i] === b[i + 1] &&
        a[i + 1] === b[i] &&
        a.slice(i + 2) === b.slice(i + 2))
    );
  }
  return a.length > b.length
    ? a.slice(i + 1) === b.slice(i)
    : a.slice(i) === b.slice(i + 1);
}

function tokenScore(query: string, candidate: string): number {
  if (query === candidate) return 12;
  if (candidate.startsWith(query)) return 9;
  if (query.length >= 3 && candidate.includes(query)) return 6;
  if (
    isNearWord(query, candidate) ||
    (candidate.endsWith('s') && isNearWord(query, candidate.slice(0, -1)))
  )
    return 4;
  return 0;
}

export function searchSettings(
  groups: readonly SettingsTabGroup[],
  query: string,
  options: {
    /** Phones always show Minimalist rows and leave out the choice. */
    emailRowStyle?: boolean;
    outlook?: boolean;
    macroComputers?: boolean;
  } = {}
): SettingsSearchResult[] {
  const tokens = words(query);
  if (!tokens.length) return [];
  const pages = groups.flatMap((group) =>
    group.items.map((page) => ({ page, group: group.label }))
  );
  const entries = pages.flatMap(({ page, group }) => [
    {
      id: page.tab,
      tab: page.tab,
      title: page.label,
      keywords: page.keywords.join(' '),
      page,
      group,
    },
    ...settingsCatalog().filter(
      (setting) =>
        setting.tab === page.tab &&
        (options.emailRowStyle !== false || setting.id !== 'emailRowStyle') &&
        (options.outlook !== false || setting.id !== 'outlook') &&
        (options.macroComputers !== false || !setting.macroComputers)
    ).map((setting) => ({
      ...setting,
      target: settingsTarget(setting.target),
      id: `${page.tab}:${setting.title}`,
      page,
      group,
    })),
  ]);
  return entries
    .map((entry) => {
      const titleWords = words(entry.title);
      // The English label keeps English searches working in any language.
      const otherWords = words(
        `${entry.keywords} ${entry.page.label} ${entry.page.englishLabel}`
      );
      const scores = tokens.map((token) =>
        Math.max(
          0,
          ...titleWords.map((word) => tokenScore(token, word) * 2),
          ...otherWords.map((word) => tokenScore(token, word))
        )
      );
      const score = scores.every(Boolean)
        ? scores.reduce((a, b) => a + b, 0)
        : 0;
      return { entry, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ entry }) => entry);
}
