import { t } from '@app/lib/i18n';
import { toast } from '@core/component/Toast/Toast';
import type { EntityData } from '@entity';
import { confirmDialog } from '@ui';
import type { EntityActionListState } from '../next-soup/actions/entity-action-context';
import { restoreSoupFocus } from '../next-soup/utils';

type MakeHideCompanyOptions = {
  canManage: () => boolean;
  setHidden: (companyId: string, hidden: boolean) => Promise<unknown>;
};

export const makeHideCompanyAction = (options: MakeHideCompanyOptions) => {
  const { setHidden } = options;

  let pending = false;
  const canExecute = (entity: EntityData): boolean =>
    entity.type === 'crm_company' && options.canManage();

  const executeWithSoup = async (
    entities: EntityData[],
    soup: EntityActionListState
  ) => {
    const entity = entities[0];
    if (entity?.type !== 'crm_company' || !options.canManage() || pending)
      return;
    pending = true;
    try {
      const confirmed = await confirmDialog({
        title: entity.hidden
          ? t('crm.restoreCompanyTitle')
          : t('crm.archiveCompanyTitle'),
        confirmLabel: entity.hidden
          ? t('viewMenus.crmRestore')
          : t('viewMenus.crmArchive'),
        body: entity.hidden
          ? t('crm.restoreCompanyBody')
          : t('crm.archiveCompanyBody'),
      });
      if (!confirmed || !options.canManage()) return;

      // The row leaves or joins the selected view once soup
      // refetches, so move focus to a neighbour first — same as delete.
      const currentIndex = soup.focus.index();
      const nextRow =
        soup.items.at(currentIndex + 1) ?? soup.items.at(currentIndex - 1);
      const hidden = entity.hidden;

      try {
        await setHidden(entity.id, !hidden);
        soup.selection.clear();
        if (nextRow) soup.focus.set(nextRow.id);
        toast.success(
          hidden ? t('crm.companyRestored') : t('crm.companyArchived')
        );
      } catch {
        toast.failure(
          hidden ? t('crm.couldNotRestore') : t('crm.couldNotArchive')
        );
      }

      await restoreSoupFocus(nextRow?.id);
    } finally {
      pending = false;
    }
  };

  return { canExecute, executeWithSoup };
};
