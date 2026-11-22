import { t } from '@app/lib/i18n';
import { isTouchDevice } from '@core/mobile/isTouchDevice';
import ArchiveIcon from '@icon/system/regular/archive.svg';
import UndoIcon from '@icon/system/regular/arrow-u-up-left.svg';
import { Button, ButtonGroup, ConfirmDialog } from '@ui';
import { createSignal, createUniqueId, onCleanup, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';

type RecordVisibilityActionProps = {
  recordId: string;
  kind: 'company' | 'contact';
  name: string;
  hidden: boolean;
  canManage: boolean;
  pending: boolean;
  iconOnly?: boolean;
  grouped?: boolean;
  parentArchived?: boolean;
  parentPending?: boolean;
  onOpenParent?: () => void;
  onChange: (
    hidden: boolean,
    onSuccess: () => void,
    onError: () => void
  ) => void;
};

/** Archive uses the existing reversible, team-scoped hidden state. */
export function RecordVisibilityAction(props: RecordVisibilityActionProps) {
  return (
    <Show when={props.recordId} keyed>
      {(recordId) => <VisibilityControl {...props} recordId={recordId} />}
    </Show>
  );
}

function VisibilityControl(props: RecordVisibilityActionProps) {
  const [confirming, setConfirming] = createSignal(false);
  const [failed, setFailed] = createSignal(false);
  const [submitting, setSubmitting] = createSignal(false);
  const permissionHintId = createUniqueId();
  const permissionHint = t('crm.askAdminToArchive');
  let alive = true;
  let button: HTMLButtonElement | undefined;
  onCleanup(() => {
    alive = false;
    if (!submitting() || (!confirming() && document.activeElement !== button))
      return;
    const id = props.recordId;
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLButtonElement>(
          `[data-crm-visibility-record="${CSS.escape(id)}"]`
        )
        ?.focus()
    );
  });
  const label = () =>
    props.hidden ? t('viewMenus.crmRestore') : t('viewMenus.crmArchive');
  const pending = () => props.pending || submitting();
  const submit = () => {
    if (!props.canManage || pending() || props.parentPending) return;
    if (props.hidden && props.parentArchived) return;
    setFailed(false);
    setSubmitting(true);
    props.onChange(
      !props.hidden,
      () => {
        if (!alive) return;
        setSubmitting(false);
        setConfirming(false);
      },
      () => {
        if (!alive) return;
        setSubmitting(false);
        setFailed(true);
      }
    );
  };
  const activate = () => {
    setFailed(false);
    if (props.hidden && props.kind === 'contact' && !props.parentArchived) {
      submit();
    } else {
      setConfirming(true);
    }
  };

  return (
    <>
      <Dynamic
        component={props.grouped ? ButtonGroup.Button : Button}
        ref={button}
        data-crm-visibility-record={props.recordId}
        variant={props.hidden ? 'secondary' : 'ghost'}
        finish={props.hidden ? 'flat' : undefined}
        size={
          props.hidden
            ? 'xs'
            : isTouchDevice()
              ? 'icon-lg'
              : props.grouped
                ? 'icon-sm'
                : 'icon-md'
        }
        class={
          props.hidden
            ? "focus-visible:ring-2 focus-visible:ring-accent/20 touch:min-h-6 touch:min-w-11 touch:my-2.5 touch:before:absolute touch:before:-inset-x-px touch:before:top-1/2 touch:before:h-11 touch:before:-translate-y-1/2 touch:before:content-['']"
            : undefined
        }
        aria-label={label()}
        aria-describedby={!props.canManage ? permissionHintId : undefined}
        tooltip={
          !props.canManage
            ? permissionHint
            : !props.hidden
              ? label()
              : undefined
        }
        disabled={!props.canManage || pending() || props.parentPending}
        onClick={activate}
      >
        <Show
          when={props.hidden}
          fallback={<ArchiveIcon class="size-4 touch:size-6" />}
        >
          <UndoIcon class="size-3" />
        </Show>
        <Show when={props.hidden}>{label()}</Show>
      </Dynamic>
      <Show when={!props.canManage}>
        <span id={permissionHintId} class="sr-only">
          {permissionHint}
        </span>
      </Show>
      <Show when={failed() && !confirming()}>
        <span role="alert" class="text-xs text-failure">
          {t('crm.couldNotRestore')}
        </span>
      </Show>
      <ConfirmDialog
        open={confirming()}
        onOpenChange={(open) => {
          setConfirming(open);
          if (!open) setFailed(false);
        }}
        onCloseAutoFocus={(event) => {
          if (button?.isConnected) {
            event.preventDefault();
            button.focus();
          }
        }}
        title={
          props.hidden && props.parentArchived
            ? t('crm.restoreCompanyFirst')
            : t('crm.archiveEntityTitle', {
                action: label(),
                kind:
                  props.kind === 'company'
                    ? t('crm.company')
                    : t('crm.person'),
              })
        }
        confirmLabel={
          props.hidden && props.parentArchived
            ? t('crm.openCompany')
            : label()
        }
        pending={pending()}
        onConfirm={() => {
          if (!props.canManage || pending()) return;
          if (props.hidden && props.parentArchived) {
            setConfirming(false);
            props.onOpenParent?.();
          } else submit();
        }}
        body={
          <>
            <Show
              when={props.hidden}
              fallback={
                <>
                  {t('crm.archiveBodyBefore')}{' '}
                  <span class="font-medium text-ink">{props.name}</span>{' '}
                  {t('crm.archiveBodyAfter')}
                  <Show when={props.kind === 'company'}>
                    {' '}
                    {t('crm.archiveCompanyAlso')}
                  </Show>
                </>
              }
            >
              <Show
                when={props.parentArchived}
                fallback={
                  <>
                    {t('crm.restoreBodyBefore')}{' '}
                    <span class="font-medium text-ink">{props.name}</span>{' '}
                    {t('crm.restoreBodyAfter')}
                    <Show when={props.kind === 'company'}>
                      {' '}
                      {t('crm.restoreCompanyAlso')}
                    </Show>
                  </>
                }
              >
                {t('crm.restoreParentArchived')}
              </Show>
            </Show>
            <Show when={failed()}>
              <p role="alert" class="mt-3 text-failure">
                {t('crm.couldNotSaveChangeConfirm')}
              </p>
            </Show>
          </>
        }
      />
    </>
  );
}
