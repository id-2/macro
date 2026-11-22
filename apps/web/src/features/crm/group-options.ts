import { t } from '@app/lib/i18n';
import { SYSTEM_PROPERTY_IDS } from '@property/constants';
import type { GroupOption } from '../next-soup/soup-view/group-options';
export const COMPANY_GROUP_OPTIONS: GroupOption[] = [
  { value: 'none', get label() { return t('viewMenus.groupNone'); } },
  { value: `property:${SYSTEM_PROPERTY_IDS.STAGE}`, get label() { return t('crm.stage'); } },
  { value: `property:${SYSTEM_PROPERTY_IDS.COMPANY_OWNER}`, get label() { return t('crm.owner'); } },
];
