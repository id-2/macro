import type { IDocumentStorageServiceFile } from '@filesystem/file';
import type { LiveSyncSource } from '@rox-one/collaboration/collab/source';

export type MarkdownDocumentKind = 'document' | 'task' | 'snippet' | 'skill';

export type MarkdownDocumentSource =
  | { type: 'loading' }
  | { type: 'dss'; file: IDocumentStorageServiceFile }
  | { type: 'sync'; source: LiveSyncSource };
