import { t } from '@app/lib/i18n';
import { tutorialStaff } from './core/presenter';
import { TUTORIAL_IDS, type TutorialId } from './core/tutorial-id';

export type Tutorial = {
  id: TutorialId;
  /** "Learn how to use Rox Mail" */
  readonly title: string;
  /** The block's name in a sentence, like "Rox Mail". */
  readonly block: string;
  /** One line under the title in a row. */
  readonly snippet: string;
  /** The video's length, like "1:27". Kept so the row layout does not jump. */
  readonly length: string;
  /**
   * Empty on purpose. The English lessons are not shown; opening a row shows
   * a short notice instead of a video.
   */
  videoUrl: string;
  posterUrl: string;
};

const LESSON_KEYS = {
  mail: [
    'tutorials.mailTitle',
    'tutorials.mailBlock',
    'tutorials.mailSnippet',
    'tutorials.mailLength',
  ],
  home: [
    'tutorials.homeTitle',
    'tutorials.homeBlock',
    'tutorials.homeSnippet',
    'tutorials.homeLength',
  ],
  chat: [
    'tutorials.chatTitle',
    'tutorials.chatBlock',
    'tutorials.chatSnippet',
    'tutorials.chatLength',
  ],
  tasks: [
    'tutorials.tasksTitle',
    'tutorials.tasksBlock',
    'tutorials.tasksSnippet',
    'tutorials.tasksLength',
  ],
  docs: [
    'tutorials.docsTitle',
    'tutorials.docsBlock',
    'tutorials.docsSnippet',
    'tutorials.docsLength',
  ],
  spreadsheets: [
    'tutorials.spreadsheetsTitle',
    'tutorials.spreadsheetsBlock',
    'tutorials.spreadsheetsSnippet',
    'tutorials.spreadsheetsLength',
  ],
  databases: [
    'tutorials.databasesTitle',
    'tutorials.databasesBlock',
    'tutorials.databasesSnippet',
    'tutorials.databasesLength',
  ],
  canvas: [
    'tutorials.canvasTitle',
    'tutorials.canvasBlock',
    'tutorials.canvasSnippet',
    'tutorials.canvasLength',
  ],
  drive: [
    'tutorials.driveTitle',
    'tutorials.driveBlock',
    'tutorials.driveSnippet',
    'tutorials.driveLength',
  ],
  crm: [
    'tutorials.crmTitle',
    'tutorials.crmBlock',
    'tutorials.crmSnippet',
    'tutorials.crmLength',
  ],
  calendar: [
    'tutorials.calendarTitle',
    'tutorials.calendarBlock',
    'tutorials.calendarSnippet',
    'tutorials.calendarLength',
  ],
  calls: [
    'tutorials.callsTitle',
    'tutorials.callsBlock',
    'tutorials.callsSnippet',
    'tutorials.callsLength',
  ],
  agents: [
    'tutorials.agentsTitle',
    'tutorials.agentsBlock',
    'tutorials.agentsSnippet',
    'tutorials.agentsLength',
  ],
  roxd: [
    'tutorials.roxdTitle',
    'tutorials.roxdBlock',
    'tutorials.roxdSnippet',
    'tutorials.roxdLength',
  ],
  github: [
    'tutorials.githubTitle',
    'tutorials.githubBlock',
    'tutorials.githubSnippet',
    'tutorials.githubLength',
  ],
  scheduling: [
    'tutorials.schedulingTitle',
    'tutorials.schedulingBlock',
    'tutorials.schedulingSnippet',
    'tutorials.schedulingLength',
  ],
  whatsapp: [
    'tutorials.whatsappTitle',
    'tutorials.whatsappBlock',
    'tutorials.whatsappSnippet',
    'tutorials.whatsappLength',
  ],
} as const satisfies Record<
  TutorialId,
  readonly [string, string, string, string]
>;

function lesson(id: TutorialId): Tutorial {
  const [title, block, snippet, length] = LESSON_KEYS[id];
  return {
    id,
    get title() {
      return t(title);
    },
    get block() {
      return t(block);
    },
    get snippet() {
      return t(snippet);
    },
    get length() {
      return t(length);
    },
    videoUrl: '',
    posterUrl: tutorialStaff(id).photo,
  };
}

/**
 * Every block still has a row. None of them play a video: the English lessons
 * are replaced by a short notice until a Russian lesson is ready.
 */
export const TUTORIALS: Partial<Record<TutorialId, Tutorial>> =
  Object.fromEntries(TUTORIAL_IDS.map((id) => [id, lesson(id)])) as Partial<
    Record<TutorialId, Tutorial>
  >;
