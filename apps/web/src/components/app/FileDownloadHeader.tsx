import { FileDownloadButton } from '@core/component/FileDownload';
import { t } from '@app/lib/i18n';
import type { FileDownloadController } from '@core/util/createFileDownload';
import { HeaderActionGroup } from './HeaderActionGroup';
import { SidePanel } from './side-panel/SidePanel';

/** Shared by Drive previews and standalone file blocks. */
export function FileDownloadHeader(props: {
  download: FileDownloadController;
}) {
  return (
    <SidePanel.HeaderActions>
      <HeaderActionGroup label={t('nav.fileDownload')}>
        <FileDownloadButton grouped download={props.download} />
      </HeaderActionGroup>
    </SidePanel.HeaderActions>
  );
}
