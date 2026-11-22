import type { LoroManager } from '@rox-one/collaboration/collab/manager';
import type { LiveSyncSource } from '@rox-one/collaboration/collab/source';
import type { MARKDOWN_LORO_SCHEMA } from '@rox-one/lexical-core/markdown-loro-schema';
import type { Accessor } from 'solid-js';

/** Session ownership is independent of whether the host is a block or a native view. */
export type CollabMarkdownSession = {
  loroManager: LoroManager<typeof MARKDOWN_LORO_SCHEMA>;
  syncSource: Accessor<LiveSyncSource | undefined>;
  connectionError: Accessor<string | undefined>;
};
