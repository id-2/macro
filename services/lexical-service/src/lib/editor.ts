import { createHeadlessEditor } from '@lexical/headless';
import { SupportedNodeTypes } from '@rox-one/lexical-core';

export function createEditor() {
  const editor = createHeadlessEditor({
    nodes: SupportedNodeTypes,
  });

  return editor;
}
