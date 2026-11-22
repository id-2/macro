import { isPlatform } from '@core/util/platform';
import { DesktopAppDownload } from './components/desktop-app';
import { NativeAppInfo } from './NativeAppInfo';

/** Native APIs are only read when mounted inside the desktop app. */
export function DesktopApp() {
  if (!isPlatform('desktop')) return <DesktopAppDownload />;
  return (
    <NativeAppInfo
      title="Приложение для компьютера (альфа)"
      description="Установленная у вас альфа-версия Rox."
    />
  );
}
