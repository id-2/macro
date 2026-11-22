import { isDesktopPlatform } from '@core/util/platform';
import ArrowUpRightIcon from '@icon/system/regular/arrow-up-right.svg';
import { cn } from '@ui';
import { type JSX, Show } from 'solid-js';

/** One numbered step in a connection guide; steps share a connecting rail. */
export function SetupStep(props: {
  number: number;
  title: string;
  children: JSX.Element;
}) {
  return (
    <li class="relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3 pb-7 last:pb-0 before:absolute before:top-9 before:bottom-2 before:left-[13px] before:w-px before:bg-edge-muted last:before:hidden">
      <span
        aria-hidden="true"
        class="flex size-7 items-center justify-center rounded-full border border-edge-muted text-xs font-medium text-ink-muted"
      >
        {props.number}
      </span>
      <div class="min-w-0 pt-0.5">
        <h2 class="text-sm font-medium text-ink">{props.title}</h2>
        <div class="mt-2 flex flex-col gap-3 text-sm leading-relaxed text-ink-muted">
          {props.children}
        </div>
      </div>
    </li>
  );
}

/** An external link out of a setup step, e.g. to download or a dashboard. */
export function SetupLink(props: { href: string; children: JSX.Element }) {
  return (
    <a
      href={props.href}
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex w-fit items-center gap-1.5 rounded-lg border border-edge-muted px-3 py-2 text-xs font-medium text-ink hover:bg-ink/5 focus-visible:outline-accent"
    >
      {props.children} <ArrowUpRightIcon aria-hidden="true" class="size-3.5" />
    </a>
  );
}

/** The bordered box around a guide's input, matching the pairing-code field. */
export function SetupField(props: { class?: string; children: JSX.Element }) {
  return (
    <div
      class={cn(
        'flex min-w-0 items-center gap-2 rounded-lg border border-edge-muted bg-ink/[0.025] px-3 py-2 transition-colors focus-within:border-accent',
        props.class
      )}
    >
      {props.children}
    </div>
  );
}

// Published installer is still this macro-inc raw URL. Checked 2026-11-19:
// https://raw.githubusercontent.com/rox-one/rox/main/crates/coding_agent_worker/install/install.sh
// returns 404, and install.sh in this repo still downloads releases from macro-inc/macro.
const INSTALL_SCRIPT_BASE =
  'https://raw.githubusercontent.com/macro-inc/macro/main/crates/coding_agent_worker/install';

/** A shell command to type, behind its prompt; long commands wrap. */
function SetupCommand(props: { prompt: string; command: string }) {
  return (
    <div class="flex gap-2 rounded-lg border border-edge-muted bg-ink/[0.025] px-3 py-2 font-mono text-sm text-ink">
      <span aria-hidden="true" class="select-none text-ink-extra-muted">
        {props.prompt}
      </span>
      <code class="min-w-0 [overflow-wrap:anywhere]">{props.command}</code>
    </div>
  );
}

/** Installation instructions surrounding the live pairing-code form. */
export function RuntimeSetupSteps(props: { children: JSX.Element }) {
  return (
    <>
      <Show when={isDesktopPlatform()}>
        <p class="mb-6 rounded-lg border border-edge-muted bg-ink/[0.025] px-3 py-2 text-sm text-ink-muted">
          Настраиваете этот компьютер? В приложении для рабочего стола уже есть
          roxd — на странице «Машины» откройте карточку{' '}
          <span class="font-medium text-ink">Этот компьютер</span>. Скачивать
          ничего не нужно, код сопряжения не понадобится. Шаги ниже подключают
          другую машину.
        </p>
      </Show>
      <ol aria-label="Шаги настройки машины" class="list-none">
        <SetupStep number={1} title="Установите roxd">
          <p>На macOS или Linux выполните в терминале:</p>
          <SetupCommand
            prompt="$"
            command={`curl -fsSL ${INSTALL_SCRIPT_BASE}/install.sh | sh`}
          />
          <p>В Windows выполните в PowerShell:</p>
          <SetupCommand
            prompt=">"
            command={`irm ${INSTALL_SCRIPT_BASE}/install.ps1 | iex`}
          />
          <p>Позже запустите ту же команду ещё раз, чтобы обновить roxd.</p>
        </SetupStep>
        <SetupStep number={2} title="Запустите roxd">
          <p>
            Откройте терминал в папке, где roxd должен хранить свои настройки, и
            выполните:
          </p>
          <SetupCommand prompt="$" command="roxd" />
          <p>
            В окне «Быстрый старт» выберите агента, рабочую папку и доступ,
            затем нажмите{' '}
            <span class="font-medium text-ink">Создать и привязать</span>. Не
            закрывайте roxd.
          </p>
        </SetupStep>
        <SetupStep number={3} title="Введите код сопряжения">
          <p>
            Введите код устройства из терминала, чтобы проверить и подключить
            эту машину.
          </p>
          {props.children}
        </SetupStep>
      </ol>
    </>
  );
}
