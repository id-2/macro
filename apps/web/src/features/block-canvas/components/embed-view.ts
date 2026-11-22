import type { DocumentGeometry } from '@rox-one/graphics';
export type CanvasEmbedViewProps = {
  geometry: DocumentGeometry;
  active: boolean;
  onExit: () => void;
};
