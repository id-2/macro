import { AiChatEmptyState } from '@core/component/AI/component/AIChatEmptyState';
import { createControlledOpenSignal } from '@core/util/createControlledOpenSignal';
import { Dialog, Surface } from '@ui';
import { Show } from 'solid-js';

const [roxMcpSetupOpen, setMacroMcpSetupOpen] = createControlledOpenSignal(
  false,
  {
    id: 'rox-mcp-setup',
  }
);

export const openMacroMcpSetupModal = () => {
  setMacroMcpSetupOpen(true);
};

const _closeMacroMcpSetupModal = () => {
  setMacroMcpSetupOpen(false);
};

export function RoxMcpSetupModal() {
  return (
    <Show when={roxMcpSetupOpen()}>
      <Dialog
        open={roxMcpSetupOpen()}
        onOpenChange={setMacroMcpSetupOpen}
        class="w-190"
      >
        <Surface depth={2} class="rounded-xl">
          <div class="*:max-h-[75vh]">
            <AiChatEmptyState />
          </div>
        </Surface>
      </Dialog>
    </Show>
  );
}
