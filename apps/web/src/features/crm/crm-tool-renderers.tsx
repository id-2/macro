import { t } from '@app/lib/i18n';
import { BaseTool } from '@core/component/AI/component/tool/BaseTool';
import { createToolRenderer } from '@core/component/AI/component/tool/ToolRenderer';
import { ItemPreview } from '@core/component/ItemPreview';
import Buildings from '@icon/system/regular/buildings.svg';
import UserPlus from '@icon/system/regular/user-plus.svg';
import { Show, Suspense } from 'solid-js';
import {
  GetCompanyToolResponse,
  ListCompaniesToolResponse,
  pluralize,
} from './components/tool-companies';

const listCompaniesHandler = createToolRenderer({
  name: 'ListCompanies',
  render: (ctx) => {
    const companies = () => ctx.response?.data.companies ?? [];
    const statusText = () => {
      if (!ctx.response) return undefined;
      if (companies().length === 0) return t('crm.noResults');
      return t('crm.companyCount', { count: companies().length });
    };

    return (
      <BaseTool
        icon={Buildings}
        renderContext={ctx.renderContext}
        type="call"
        response={
          ctx.response ? (
            <ListCompaniesToolResponse {...ctx.response.data} />
          ) : undefined
        }
      >
        <div class="flex min-w-0 flex-1 items-center justify-between gap-3 overflow-hidden">
          <span class="min-w-0 truncate">
            {t('crm.toolListCompanies')}
            <Show when={ctx.tool.data.search}>
              {(search) => <>{' '}{t('crm.toolMatching', { search: search() })}</>}
            </Show>
            <Show when={ctx.tool.data.stage}>
              {(stage) => <>{' '}{t('crm.toolInStage', { stage: stage() })}</>}
            </Show>
          </span>
          <Show when={statusText()}>
            {(text) => (
              <span class="shrink-0 whitespace-nowrap text-xs text-ink-extra-muted">
                {text()}
              </span>
            )}
          </Show>
        </div>
      </BaseTool>
    );
  },
});

const getCompanyHandler = createToolRenderer({
  name: 'GetCompany',
  render: (ctx) => {
    const statusText = () => {
      if (!ctx.response) return undefined;
      const data = ctx.response.data;
      return data.stage?.label ?? data.domains[0];
    };

    return (
      <BaseTool
        icon={Buildings}
        renderContext={ctx.renderContext}
        type="call"
        response={
          ctx.response ? (
            <GetCompanyToolResponse {...ctx.response.data} />
          ) : undefined
        }
      >
        <div class="flex min-w-0 flex-1 items-center justify-between gap-3 overflow-hidden">
          <span class="min-w-0 truncate">
            {t('crm.toolReadCompany')}
            <Show when={ctx.response?.data.name}>
              {(name) => <> {name()}</>}
            </Show>
          </span>
          <Show when={statusText()}>
            {(text) => (
              <span class="shrink-0 whitespace-nowrap text-xs text-ink-extra-muted">
                {text()}
              </span>
            )}
          </Show>
        </div>
      </BaseTool>
    );
  },
});

function CompanyPreview(props: { companyId: string }) {
  return (
    <Suspense>
      <ItemPreview
        class="inline-flex align-middle ring-0"
        id={props.companyId}
        type="crm_company"
      />
    </Suspense>
  );
}

const createCompanyHandler = createToolRenderer({
  name: 'CreateCompany',
  render: (ctx) => (
    <BaseTool icon={Buildings} renderContext={ctx.renderContext} type="call">
      <div class="min-w-0 flex-1">
        <Show
          when={ctx.response?.data.companyId}
          fallback={
            <>
              {t('crm.toolAddCompany')}{' '}
              <span class="text-ink">{ctx.tool.data.name}</span>
              <Show when={ctx.tool.data.domain}>
                {(domain) => <> ({domain()})</>}
              </Show>
            </>
          }
        >
          {(companyId) => (
            <>
              {t('crm.toolAddedCompany')}{' '}
              <CompanyPreview companyId={companyId()} />
            </>
          )}
        </Show>
      </div>
    </BaseTool>
  ),
});

const createContactHandler = createToolRenderer({
  name: 'CreateContact',
  render: (ctx) => (
    <BaseTool icon={UserPlus} renderContext={ctx.renderContext} type="call">
      <div class="min-w-0 flex-1">
        {ctx.response ? t('crm.toolAddedContact') : t('crm.toolAddContact')}{' '}
        <span class="text-ink">{ctx.tool.data.name}</span>
        <Show when={ctx.tool.data.email}>{(email) => <> ({email()})</>}</Show>
        <Show when={ctx.tool.data.companyId}>
          {(companyId) => (
            <>
              {' '}
              {t('crm.toolToCompany')}{' '}
              <CompanyPreview companyId={companyId()} />
            </>
          )}
        </Show>
      </div>
    </BaseTool>
  ),
});

export {
  createCompanyHandler,
  createContactHandler,
  getCompanyHandler,
  listCompaniesHandler,
};
