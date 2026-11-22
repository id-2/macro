import { VIEW_SHELL_TOUR } from '@app/components/view-shell/tour';
import { defineViewTour } from '@app/features/tours/core/view-tour';
import { t } from '@app/lib/i18n';

/** The Drive tour in the current interface language. */
export const documentsTour = () =>
  defineViewTour({
    id: 'documents',
    title: t('nav.documents'),
    connector: { kind: 'mcp', label: 'Notion', tools: ['Notion'] },
    video: { youtubeId: 'V8wE8Hq5_qw', title: 'Rox Docs', duration: '1:09' },
    steps: [
      {
        target: VIEW_SHELL_TOUR.aside,
        entry: VIEW_SHELL_TOUR.sidebarToggle,
        entryLabel: t('drive.tourEntryLabel'),
        title: t('drive.tourIdeasTitle'),
        description: t('drive.tourIdeasDescription'),
      },
      {
        target: VIEW_SHELL_TOUR.main,
        title: t('drive.tourContextTitle'),
        description: t('drive.tourContextDescription'),
      },
      {
        target: VIEW_SHELL_TOUR.topBar,
        title: t('drive.tourTogetherTitle'),
        description: t('drive.tourTogetherDescription'),
      },
    ],
  });
