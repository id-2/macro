import { t } from '@app/lib/i18n';
import { Avatar, AvatarGroup, Button } from '@ui';
import { For } from 'solid-js';
import { TUTORIAL_STAFF } from '../core/presenter';

/** The people a person can write to, shown as faces only. */
const SUPPORT_TEAM_PHOTOS = TUTORIAL_STAFF.slice(0, 3).map(
  (person) => person.photo
);

/**
 * The strip under the notice: faces, then a question, then the way into the
 * person's own support channel.
 */
export function TutorialSupportLip(props: {
  /** The block the lesson is about, like "Rox CRM". */
  block: string;
  onSelect: () => void;
}) {
  return (
    <div class="-mt-1 flex min-h-10 shrink-0 flex-wrap items-center justify-center px-4 pb-1 text-center text-sm text-ink-muted">
      <AvatarGroup
        size="md"
        aria-hidden="true"
        class="mr-2.5 [--avatar-group-separator:var(--color-dialog)]"
      >
        <For each={SUPPORT_TEAM_PHOTOS}>
          {(photo) => (
            <Avatar size="md">
              <Avatar.Image src={photo} alt="" />
              <Avatar.Fallback />
            </Avatar>
          )}
        </For>
      </AvatarGroup>
      <span>{t('tutorials.supportQuestion', { block: props.block })}</span>
      <Button variant="link" size="sm" onClick={props.onSelect}>
        Написать в канал поддержки
      </Button>
    </div>
  );
}
