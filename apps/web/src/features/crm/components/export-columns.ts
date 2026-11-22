import { t } from '@app/lib/i18n';
import { SYSTEM_PROPERTY_IDS } from '@property/constants';
import type { ExportColumn } from '../core/export';
export const COMPANY_EXPORT_COLUMNS: ExportColumn[] = [
  { id: 'name', get label() {
      return t('crm.company');
    }, default: true },
  { id: 'domains', get label() {
      return t('crm.domains');
    }, default: true },
  { id: 'stage', get label() {
      return t('crm.stage');
    }, default: true },
  { id: 'owner', get label() {
      return t('crm.owner');
    }, default: true },
  {
    id: `property:${SYSTEM_PROPERTY_IDS.REVENUE}`,
    get label() {
      return t('crm.revenue');
    },
    default: true,
  },
  { id: 'lastInteraction', get label() {
      return t('crm.lastInteractionLower');
    }, default: true },
  { id: 'firstInteraction', get label() {
      return t('crm.firstInteraction');
    } },
  { id: 'description', get label() {
      return t('crm.description');
    } },
  { id: 'emailSync', get label() {
      return t('crm.emailSync');
    } },
  { id: 'id', get label() {
      return t('crm.companyId');
    } },
];
