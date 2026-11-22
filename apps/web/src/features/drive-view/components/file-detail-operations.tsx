import { t } from '@app/lib/i18n';
import type { FileOperation } from '@components/app/split-layout/components/SplitFileMenu';
import DownloadSimple from '@icon/system/regular/download-simple.svg';

export function downloadFileOperation(action: () => void): FileOperation {
  return {
    group: 'file',
    get label() {
      return t('drive.download');
    },
    icon: DownloadSimple,
    action,
  };
}
