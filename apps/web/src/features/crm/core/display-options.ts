import { t } from '@app/lib/i18n';

export type CrmListColumnId = 'stage' | 'owner' | 'revenue';

export type CrmDisplayOptions = {
  /** Visible list columns (order stays fixed; this only hides/shows). */
  listColumns: Record<CrmListColumnId, boolean>;
};

export const DEFAULT_CRM_DISPLAY_OPTIONS: CrmDisplayOptions = {
  listColumns: { stage: false, owner: true, revenue: true },
};

export function crmListColumnLabel(column: CrmListColumnId): string {
  if (column === 'stage') return t('crm.stage');
  if (column === 'owner') return t('crm.owner');
  return t('crm.revenue');
}
