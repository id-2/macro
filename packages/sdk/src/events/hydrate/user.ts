import { match } from 'ts-pattern';
import { StaticImage } from '../../entities/images/image';
import { User } from '../../entities/users/user';
import type { RoxClient } from '../../utils/client';
import type { RoxEvent } from '../types';

export type UserEvent = Extract<RoxEvent, { event_type: `user.${string}` }>;

/** Attach SDK entity handles to a user webhook event. */
export function hydrateUserEvent(client: RoxClient, event: UserEvent) {
  return match(event)
    .with({ event_type: 'user.picture_changed' }, ({ metadata }) => ({
      event_type: 'user.picture_changed' as const,
      metadata,
      user: User.byId(client, metadata.user_id),
      image: metadata.file_id
        ? StaticImage.byId(client, metadata.file_id)
        : undefined,
    }))
    .exhaustive((unknown) => {
      console.warn('macro sdk: unknown user event', unknown);
      return undefined;
    });
}
