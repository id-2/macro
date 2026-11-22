import { UserIcon } from '@core/component/UserIcon';
import type { EmailMessage } from './core/email-message';
import { getSenderRoxId } from './core/email-user';

/** Profile lookup and the interactive user card belong to application composition. */
export function EmailSenderIcon(props: { message: EmailMessage }) {
  const sender = () => {
    const id = getSenderRoxId(props.message);
    const photoUrl = props.message.from?.photo_url ?? undefined;
    return id
      ? { id, photoUrl }
      : { email: props.message.from?.email ?? '', photoUrl };
  };
  return <UserIcon {...sender()} size="fill" suppressClick />;
}
