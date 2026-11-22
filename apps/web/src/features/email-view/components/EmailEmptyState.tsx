import { DOCS_BASE } from '@app/constants/docs-links';
import { useAddInboxFlow, useEmailLinksStatus } from '@core/email-link';
import { fireAndForget } from '@core/util/fireAndForget';
import EmptyStateEmailGraphic from '@design/empty-state-email.svg';
import EmptyStateInboxTrayGraphic from '@design/empty-state-inbox-tray.svg';
import EmptyStateNoFilterMatchGraphic from '@design/empty-state-no-filter-match.svg';
import EmptyStateNoSearchMatchGraphic from '@design/empty-state-no-search-match.svg';
import { FOCUS_WINDOW_DAYS } from '@queries/email/focus';
import { EmptyStatePanel, FilteredHiddenBanner } from '@ui';
import { Match, Switch } from 'solid-js';
import { match } from 'ts-pattern';
import { canSearchEmailTab } from '../constants';
import { useEmailView } from '../email-view-context';
import type { EmailTab } from '../types';

const EMAIL_DOCS_URL = `${DOCS_BASE}/product/email`;

function tabCopy(tab: EmailTab): { title: string; description: string } {
  return match(tab)
    .with('important', () => ({
      title: 'Входящие разобраны',
      description:
        'Новых писем нет. Письма появятся здесь, как только придут.',
    }))
    .with('noise', () => ({
      title: 'Шума нет',
      description:
        'Сюда собирается почта без приоритета: рассылки и уведомления. Сейчас разбирать нечего.',
    }))
    .with('favorites', () => ({
      title: 'Избранных писем нет',
      description: 'Отметьте письмо звёздочкой, чтобы оно всегда было под рукой.',
    }))
    .with('sent', () => ({
      title: 'Отправленных писем нет',
      description: 'Здесь появятся письма, которые вы отправите.',
    }))
    .with('scheduled', () => ({
      title: 'Отложенных писем нет',
      description: 'Здесь появятся письма, отправку которых вы отложите.',
    }))
    .with('reminders', () => ({
      title: 'Напоминаний о письмах нет',
      description: 'Нажмите «Напомнить» в письме, чтобы вернуться к нему позже.',
    }))
    .with('calendar', () => ({
      title: 'Писем календаря нет',
      description: 'Здесь появятся приглашения и изменения событий.',
    }))
    .with('drafts', () => ({
      title: 'Черновиков нет',
      description: 'Здесь появятся письма, которые вы начали, но ещё не отправили.',
    }))
    .with('shared', () => ({
      title: 'Писем, которыми поделились, нет',
      description: 'Здесь появятся переписки, которыми с вами поделятся коллеги.',
    }))
    .with('archived', () => ({
      title: 'Архив пуст',
      description: 'Здесь появятся письма, которые вы отправите в архив.',
    }))
    .with('focus', () => ({
      title: 'Всё разобрано',
      description: `Здесь показывается почта, достойная внимания, за последние ${FOCUS_WINDOW_DAYS} дней.`,
    }))
    .with('spam', () => ({
      title: 'Спама нет',
      description:
        'Здесь появляются письма, помеченные как спам или нежелательные во входящих, которые вы подключили.',
    }))
    .with('trash', () => ({
      title: 'Корзина пуста',
      description:
        'Здесь лежат удалённые письма из подключённых входящих, пока их не удалят окончательно.',
    }))
    .with('all', () => ({
      title: 'Писем пока нет',
      description: 'Всё, что придёт во входящие, появится здесь.',
    }))
    .exhaustive();
}

export function EmailEmptyState() {
  const { state, setInboxIds, setTab, filtersChanged, clearFilters } =
    useEmailView();
  const emailActive = useEmailLinksStatus();
  const startAddInbox = useAddInboxFlow();
  // Scheduled has no search or filters; text typed on another tab stays behind.
  const searchText = () =>
    canSearchEmailTab(state.tab) ? state.search.trim() : '';
  const noInboxesSelected = () => state.inboxIds?.length === 0;

  // These states fill the list pane, which is narrow beside the reading pane,
  // so they center in it instead of hugging the sidebar.
  return (
    <Switch>
      <Match when={!emailActive()}>
        <EmptyStatePanel
          centered
          graphic={EmptyStateEmailGraphic}
          title="Подключите почту"
          description="Перенесите входящие в Rox, чтобы отделять важное от остального, отвечать быстрее и работать с письмами вместе с агентами."
          primaryAction={{
            label: 'Подключить почту',
            onClick: () => fireAndForget(startAddInbox(), 'add-inbox'),
          }}
          documentationLabel="Документация"
        />
      </Match>

      <Match when={noInboxesSelected()}>
        <EmptyStatePanel
          centered
          graphic={EmptyStateInboxTrayGraphic}
          title="Ящики не выбраны"
          description="Выберите хотя бы один ящик, чтобы увидеть его письма."
          primaryAction={{
            label: 'Показать все ящики',
            onClick: () => setInboxIds(undefined),
          }}
        />
      </Match>

      <Match when={searchText()}>
        {(search) => (
          <EmptyStatePanel
            centered
            graphic={EmptyStateNoSearchMatchGraphic}
            title={`По запросу «${search()}» ничего не нашлось`}
            description={
              state.tab === 'focus'
                ? 'Поиск по важному ищет в темах, отправителях и превью. Попробуйте другой запрос.'
                : 'Поиск идёт по темам, отправителям и тексту писем. Попробуйте другой запрос.'
            }
            documentationUrl={`${DOCS_BASE}/product/search`}
          />
        )}
      </Match>

      <Match when={filtersChanged()}>
        <EmptyStatePanel
          centered
          graphic={EmptyStateNoFilterMatchGraphic}
          title="Под фильтры ничего не подходит"
          description="Измените или сбросьте фильтры, чтобы увидеть больше."
        >
          <FilteredHiddenBanner
            hasHiddenItems={false}
            onClearFilters={clearFilters}
          />
        </EmptyStatePanel>
      </Match>

      <Match when={tabCopy(state.tab)}>
        {(copy) => (
          <EmptyStatePanel
            centered
            graphic={EmptyStateInboxTrayGraphic}
            title={copy().title}
            description={copy().description}
            primaryAction={
              state.tab === 'focus'
                ? {
                    label: 'Показать остальные входящие',
                    onClick: () => setTab('important'),
                  }
                : undefined
            }
            documentationUrl={EMAIL_DOCS_URL}
          />
        )}
      </Match>
    </Switch>
  );
}
