import { t } from '@app/lib/i18n';
import { fileFolderDrop } from '@core/directive/fileFolderDrop';
import ArrowsOutIcon from '@icon/system/regular/arrows-out.svg';
import FileIcon from '@icon/system/regular/file.svg';
import FolderIcon from '@icon/system/regular/folder.svg';
import UploadIcon from '@icon/system/regular/upload-simple.svg';
import XIcon from '@icon/system/regular/x.svg';
import { Button, EntityComposer } from '@ui';
import { createSignal, For, type JSX, Show } from 'solid-js';
import type { FolderUpload } from '../core/folder-composer';

false && fileFolderDrop;

export function FolderComposer(props: {
  name: string;
  destination: string;
  files: FolderUpload[];
  showUploads?: boolean;
  tags: JSX.Element;
  busy: boolean;
  preparing: boolean;
  created: boolean;
  error?: string;
  onName(value: string): void;
  onRemove(file: FolderUpload): void;
  onFiles(): void;
  onFolder(): void;
  onDrop(
    files: FileSystemFileEntry[],
    folders: FileSystemDirectoryEntry[]
  ): void;
  onClear(): void;
  onClose(): void;
  onExpand?(): void;
  onSubmit(): void;
}) {
  const [dragging, setDragging] = createSignal(false);
  let nameInput: HTMLInputElement | undefined;
  return (
    <form
      class="h-full min-h-0"
      aria-label={t('drive.newFolderTitle')}
      aria-busy={props.busy}
      onSubmit={(event) => {
        event.preventDefault();
        props.onSubmit();
      }}
      onKeyDown={(event) => {
        if (
          event.key === 'Enter' &&
          (event.metaKey || event.ctrlKey) &&
          !event.isComposing
        ) {
          event.preventDefault();
          event.stopPropagation();
          props.onSubmit();
        }
      }}
    >
      <EntityComposer.Root>
        <EntityComposer.Header>
          <div class="flex-1 flex items-center">
            <Show when={props.onExpand}>
              <Button
                variant="ghost"
                tabIndex={-1}
                size="icon-md"
                aria-label={t('drive.continueInSplit')}
                tooltip={t('drive.continueInSplit')}
                disabled={props.busy}
                onClick={props.onExpand}
              >
                <ArrowsOutIcon class="size-4 touch:size-6 shrink-0 pointer-events-none" />
              </Button>
            </Show>
          </div>
          <Show when={!props.created}>
            <Button
              tabIndex={-1}
              size="sm"
              variant="secondary"
              disabled={props.busy}
              onClick={() => {
                props.onClear();
                nameInput?.focus();
              }}
            >
              {t('drive.clearDraft')}
            </Button>
          </Show>
          <Button
            variant="ghost"
            tabIndex={-1}
            size="icon-md"
            aria-label={t('drive.close')}
            tooltip={t('drive.close')}
            disabled={props.busy}
            onClick={props.onClose}
          >
            <XIcon class="size-4 touch:size-6 shrink-0 pointer-events-none" />
          </Button>
        </EntityComposer.Header>
        <EntityComposer.Main class="gap-4">
          <EntityComposer.Title class="mb-0">
            <input
              ref={nameInput}
              autofocus
              aria-label={t('drive.folderName')}
              placeholder={t('drive.folderName')}
              required
              class="ph-no-capture w-full min-w-0 text-xl/7 font-medium outline-none bg-transparent placeholder:text-ink-placeholder"
              value={props.name}
              disabled={props.busy || props.created}
              onInput={(event) => props.onName(event.currentTarget.value)}
            />
          </EntityComposer.Title>
          <fieldset
            disabled={props.busy || props.created}
            class="px-2 disabled:pointer-events-none disabled:opacity-60"
          >
            <EntityComposer.Properties>{props.tags}</EntityComposer.Properties>
          </fieldset>
          <Show when={props.showUploads !== false}>
            <div
              class="mx-2 flex min-h-60 flex-1 flex-col overflow-auto rounded-lg border border-dashed border-edge-muted p-4"
              classList={{ 'bg-hover': dragging() }}
              use:fileFolderDrop={{
                disabled: props.busy,
                onDrop: props.onDrop,
                onDragStart: setDragging,
                onDragEnd: () => setDragging(false),
              }}
            >
              <div class="flex min-h-44 flex-1 flex-col items-center justify-center gap-3 text-center">
                <UploadIcon class="size-8 text-ink-extra-muted" />
                <div>
                  <p class="text-sm text-ink">
                    {t('drive.dropFolderFiles')}
                  </p>
                  <p class="mt-1 text-xs text-ink-muted">
                    {t('drive.dropFolderFilesHint')}
                  </p>
                </div>
                <div class="flex flex-wrap justify-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={props.busy}
                    onClick={props.onFiles}
                  >
                    {t('drive.addFiles')}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={props.busy}
                    onClick={props.onFolder}
                  >
                    {t('drive.addFolder')}
                  </Button>
                </div>
                <Show when={props.preparing}>
                  <p role="status" class="text-xs text-ink-muted">
                    {t('drive.preparingFiles')}
                  </p>
                </Show>
              </div>
              <Show when={props.files.length}>
                <ul
                  aria-label={t('drive.folderContents')}
                  class="mt-4 flex flex-col gap-1 border-t border-edge-muted pt-3"
                >
                  <For each={props.files}>
                    {(entry) => (
                      <li class="flex min-w-0 items-center gap-2 text-sm">
                        <Show
                          when={entry.isFolder}
                          fallback={
                            <FileIcon class="size-4 shrink-0 text-ink-muted" />
                          }
                        >
                          <FolderIcon class="size-4 shrink-0 text-ink-muted" />
                        </Show>
                        <span
                          class="min-w-0 flex-1 truncate"
                          title={entry.file.name}
                        >
                          {entry.isFolder
                            ? entry.file.name.replace(/\.zip$/, '')
                            : entry.file.name}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t('drive.removeFile', {
                            name: entry.file.name,
                          })}
                          tooltip={t('drive.remove')}
                          disabled={props.busy}
                          onClick={() => props.onRemove(entry)}
                        >
                          <XIcon class="size-3.5 touch:size-6 shrink-0 pointer-events-none" />
                        </Button>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
            </div>
          </Show>
        </EntityComposer.Main>
        <Show when={props.error}>
          <p role="alert" class="px-2 text-sm text-failure">
            {props.error}
          </p>
        </Show>
        <EntityComposer.Footer class="items-center">
          <span class="flex min-w-0 items-center gap-1.5 px-2 text-xs text-ink-muted">
            <FolderIcon class="size-4 shrink-0" />
            <span class="truncate" title={props.destination}>
              {t('drive.insideDestination', { destination: props.destination })}
            </span>
          </span>
          <EntityComposer.Submit
            type="submit"
            hasContent={!!props.name.trim()}
            disabled={props.busy || !props.name.trim()}
          >
            {props.busy
              ? props.preparing
                ? t('drive.preparing')
                : t('drive.creating')
              : props.created
                ? t('drive.retry')
                : t('drive.createFolder')}
          </EntityComposer.Submit>
        </EntityComposer.Footer>
      </EntityComposer.Root>
    </form>
  );
}
