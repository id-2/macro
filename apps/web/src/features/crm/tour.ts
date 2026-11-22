import { t } from '@app/lib/i18n';
import { VIEW_SHELL_TOUR } from '@app/components/view-shell/tour';
import { defineViewTour } from '@app/features/tours/core/view-tour';
import { defineTourTargets } from '@ui/components/Tour';

export const COMPANIES_TOUR = defineTourTargets('companies', [
  'records',
  'create',
]);

export const companiesTour = defineViewTour({
  id: 'companies',
  get title() {
    return t('crm.tourTitle');
  },
  connector: {
    kind: 'mcp',
    get label() {
      return t('crm.tourConnector');
    },
    tools: ['HubSpot', 'Attio'],
  },
  video: {
    youtubeId: '5d2K_NYs50k',
    get title() {
      return t('crm.tourVideoTitle');
    },
    duration: '2:33',
  },
  steps: [
    {
      target: COMPANIES_TOUR.records,
      entry: VIEW_SHELL_TOUR.sidebarToggle,
      get entryLabel() {
        return t('crm.tourSidebarEntry');
      },
      get title() {
        return t('crm.tourCompaniesTitle');
      },
      get description() {
        return t('crm.tourCompaniesDescription');
      },
    },
    {
      target: VIEW_SHELL_TOUR.main,
      get title() {
        return t('crm.tourRelationshipTitle');
      },
      get description() {
        return t('crm.tourRelationshipDescription');
      },
    },
    {
      target: COMPANIES_TOUR.create,
      entry: VIEW_SHELL_TOUR.sidebarToggle,
      get entryLabel() {
        return t('crm.tourSidebarEntry');
      },
      get title() {
        return t('crm.tourCreateTitle');
      },
      get description() {
        return t('crm.tourCreateDescription');
      },
    },
  ],
});
