import { DOCS_BASE } from '@app/constants/docs-links';
import { useAddInboxFlow, useEmailLinksStatus } from '@core/email-link';
import { fireAndForget } from '@core/util/fireAndForget';
import EmptyStateInboxTrayGraphic from '@design/empty-state-inbox-tray.svg';
import EmptyStateNoFilterMatchGraphic from '@design/empty-state-no-filter-match.svg';
import EmptyStateNoSearchMatchGraphic from '@design/empty-state-no-search-match.svg';
import { EmptyStatePanel, FilteredHiddenBanner } from '@ui';
import { Match, Switch } from 'solid-js';
import { useHomeView } from '../home-view-context';

export function HomeEmptyState() {
  const { state, setFacets } = useHomeView();
  const emailActive = useEmailLinksStatus();
  const startAddInbox = useAddInboxFlow();
  const searchText = () => state.search.trim();
  const hasActiveFilters = () =>
    Object.values(state.facets).some((optionIds) => optionIds.length > 0);

  return (
    <Switch>
      <Match when={searchText()}>
        {(search) => (
          <EmptyStatePanel
            centered
            graphic={EmptyStateNoSearchMatchGraphic}
            title={`Ничего не найдено по запросу «${search()}»`}
            description="Ищите по сообщениям, документам, задачам и другому. Попробуйте другой запрос или ослабьте фильтры."
            documentationUrl={`${DOCS_BASE}/product/search`}
            documentationLabel="Документация"
          />
        )}
      </Match>

      <Match when={hasActiveFilters()}>
        <EmptyStatePanel
          centered
          graphic={EmptyStateNoFilterMatchGraphic}
          title="Нет элементов по этим фильтрам"
          description="Измените или сбросьте фильтры, чтобы увидеть больше результатов."
        >
          <FilteredHiddenBanner
            hasHiddenItems={false}
            onClearFilters={() => setFacets({})}
          />
        </EmptyStatePanel>
      </Match>

      <Match when={!emailActive()}>
        <EmptyStatePanel
          graphic={EmptyStateInboxTrayGraphic}
          title="Добро пожаловать"
          description="Здесь появятся недавние дела и уведомления. Подключите почту, чтобы добавить и входящие."
          primaryAction={{
            label: 'Подключить почту',
            onClick: () => fireAndForget(startAddInbox(), 'add-inbox'),
          }}
          documentationUrl={`${DOCS_BASE}/product/home`}
          documentationLabel="Документация"
        />
      </Match>

      <Match when={state.tab === 'noise'}>
        <EmptyStatePanel
          graphic={EmptyStateInboxTrayGraphic}
          title="Нет шума"
          description={
            <>
              Сюда попадают маловажные элементы: рассылки и уведомления.
              <br />
              Сейчас разбирать нечего.
            </>
          }
          documentationUrl={`${DOCS_BASE}/product/home`}
          documentationLabel="Документация"
        />
      </Match>

      <Match when={true}>
        <EmptyStatePanel
          graphic={EmptyStateInboxTrayGraphic}
          title="Активности пока нет"
          description="Здесь появятся недавние документы, отправленные письма, чаты с ИИ и уведомления."
          documentationUrl={`${DOCS_BASE}/product/home`}
          documentationLabel="Документация"
        />
      </Match>
    </Switch>
  );
}
