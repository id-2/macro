import { displayName } from '@core/constant/brand';
import IconAirtable from '@icon/import/airtable.svg';
import IconAsana from '@icon/import/asana.svg';
import IconBox from '@icon/import/box.svg';
import IconClose from '@icon/import/close.svg';
import IconConfluence from '@icon/import/confluence.svg';
import IconDropbox from '@icon/import/dropbox.svg';
import IconGoogleDrive from '@icon/import/google-drive.svg';
import IconHubSpot from '@icon/import/hubspot.svg';
import IconJira from '@icon/import/jira.svg';
import IconMonday from '@icon/import/monday.svg';
import IconNotion from '@icon/import/notion.svg';
import IconOneDrive from '@icon/import/onedrive.svg';
import IconSalesforce from '@icon/import/salesforce.svg';
import IconTrello from '@icon/import/trello.svg';
import IconGithub from '@icon/mcp-github.svg';
import IconLinear from '@icon/mcp-linear.svg';
import IconSlack from '@icon/slack-color.svg';
import type {
  ImportCategory,
  ImportCategoryConfig,
  ImportIcon,
  ImportProvider,
} from './providers';

// Order is promotion order: the sidebar card shows these left to right and
// its copy names the first few. Sources with an import ledger lead.
// Each pitch fills one line and most of a second at the default sidebar width.
export const IMPORT_CATEGORIES: Record<ImportCategory, ImportCategoryConfig> = {
  files: {
    category: 'files',
    headline: 'Импорт файлов в Диск',
    pitch:
      'Документы и файлы хранятся в Диске. Перенесите копии из Notion, Google Drive, Dropbox и других сервисов.',
    action: 'Импортировать файлы',
    dialogDescription:
      'Подключите сервис и выберите с агентом, что перенести в Диск.',
    items: 'документы и файлы',
    destination: 'мой Диск',
    providers: [
      {
        appSlug: 'notion',
        name: 'Notion',
        detail: 'Страницы и вики',
        icon: IconNotion as ImportIcon,
        ledger: 'notion',
      },
      {
        appSlug: 'google_drive',
        name: 'Google Drive',
        detail: 'Import docs, PDFs, and files',
        icon: IconGoogleDrive as ImportIcon,
      },
      {
        appSlug: 'dropbox',
        name: 'Dropbox',
        detail: 'Files and folders',
        icon: IconDropbox as ImportIcon,
      },
      {
        appSlug: 'microsoft_onedrive',
        name: 'OneDrive',
        detail: 'Files and folders',
        icon: IconOneDrive as ImportIcon,
      },
      {
        appSlug: 'box',
        name: 'Box',
        detail: 'Files and folders',
        icon: IconBox as ImportIcon,
      },
      {
        appSlug: 'confluence',
        name: 'Confluence',
        detail: 'Пространства и страницы',
        icon: IconConfluence as ImportIcon,
      },
    ],
  },
  tasks: {
    category: 'tasks',
    headline: `Перенесите задачи в ${displayName}`,
    pitch:
      'Импорт задач из Linear, Jira, Asana, GitHub и других сервисов.',
    action: 'Импортировать задачи',
    dialogDescription:
      'Подключите сервис и выберите с агентом, какие задачи перенести.',
    items: 'задачи',
    destination: `задачи в ${displayName}`,
    providers: [
      {
        appSlug: 'linear',
        name: 'Linear',
        detail: 'Задачи',
        icon: IconLinear as ImportIcon,
        ledger: 'linear',
      },
      {
        appSlug: 'jira',
        name: 'Jira',
        detail: 'Задачи',
        icon: IconJira as ImportIcon,
        ledger: 'jira',
      },
      {
        appSlug: 'asana',
        name: 'Asana',
        detail: 'Задачи',
        icon: IconAsana as ImportIcon,
      },
      {
        appSlug: 'github',
        name: 'GitHub',
        detail: 'Задачи',
        icon: IconGithub as ImportIcon,
        // Connects through the GitHub account link (an overlaid app).
      },
      {
        appSlug: 'trello',
        name: 'Trello',
        detail: 'Карточки',
        icon: IconTrello as ImportIcon,
      },
      {
        appSlug: 'monday',
        name: 'monday.com',
        detail: 'Элементы',
        icon: IconMonday as ImportIcon,
      },
    ],
  },
  crm: {
    category: 'crm',
    headline: `Перенесите клиентов в ${displayName}`,
    pitch: 'Импорт компаний и контактов из HubSpot, Salesforce и других сервисов.',
    action: 'Импортировать клиентов',
    dialogDescription:
      'Подключите сервис, и агент перенесёт компании и контакты в ваш CRM.',
    items: 'компании и контакты',
    destination: `CRM ${displayName}`,
    providers: [
      {
        appSlug: 'hubspot',
        name: 'HubSpot',
        detail: 'Компании и контакты',
        icon: IconHubSpot as ImportIcon,
      },
      {
        appSlug: 'salesforce_rest_api',
        name: 'Salesforce',
        detail: 'Аккаунты и контакты',
        icon: IconSalesforce as ImportIcon,
      },
      {
        appSlug: 'close',
        name: 'Close',
        detail: 'Лиды и контакты',
        icon: IconClose as ImportIcon,
      },
      {
        appSlug: 'airtable_oauth',
        name: 'Airtable',
        detail: 'Записи из базы',
        icon: IconAirtable as ImportIcon,
      },
    ],
  },
  channels: {
    category: 'channels',
    headline: 'Создайте каналы или импортируйте их',
    pitch:
      'Перенос каналов и участников Slack вместе с историей сообщений или без неё.',
    action: 'Импортировать из Slack',
    dialogDescription:
      'Подключите Slack и выберите каналы с агентом или загрузите выгрузку с историей.',
    items: 'каналы',
    destination: `каналы ${displayName}`,
    providers: [
      {
        appSlug: 'slack',
        name: 'Slack',
        detail: 'Каналы',
        icon: IconSlack as ImportIcon,
        ledger: 'slack',
      },
    ],
  },
};

/** Where Rox can import an app's data from, if it can. */
export function importSourceFor(
  appSlug: string
): { config: ImportCategoryConfig; provider: ImportProvider } | undefined {
  for (const config of Object.values(IMPORT_CATEGORIES)) {
    const provider = config.providers.find((row) => row.appSlug === appSlug);
    if (provider) return { config, provider };
  }
  return undefined;
}
