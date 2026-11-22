import { buttonClasses } from '@ui';
import { SettingsCard, SettingsPage, SettingsRow } from '../primitives';

export function DesktopAppDownload() {
  return (
    <SettingsPage
      title="Приложение для компьютера (альфа)"
      description="Установите альфа-версию Rox на компьютер."
    >
      <SettingsCard>
        <SettingsRow
          label="Скачать альфа-версию Rox"
          description="Последний выпуск для macOS или Linux."
          stackOnNarrow
        >
          <a
            href="https://github.com/macro-inc/macro/releases/latest"
            target="_blank"
            rel="noopener noreferrer"
            class={buttonClasses({ variant: 'secondary', size: 'md' })}
          >
            Скачать приложение
          </a>
        </SettingsRow>
      </SettingsCard>
    </SettingsPage>
  );
}
