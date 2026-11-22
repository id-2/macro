import { t } from '@app/lib/i18n';

/** Session kind used for routes and the agent workspace's presentation. */
export type AgentsMode = 'chat' | 'code';

/**
 * The new-conversation composer's choice: a session kind, or Auto, which asks
 * the backend which kind each prompt needs and starts the user's usual agent.
 */
export type ComposerMode = AgentsMode | 'auto';

/** The composer's mode switch: Авто, Чат, and Код in the interface language. */
export function agentsModeLabel(mode: ComposerMode): string {
  if (mode === 'auto') return t('agentControls.modeAuto');
  return mode === 'code'
    ? t('agentControls.modeCode')
    : t('agentControls.modeChat');
}
