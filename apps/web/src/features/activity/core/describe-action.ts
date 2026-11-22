import { t } from '@app/lib/i18n';
import { match } from 'ts-pattern';
import { entryAction, entrySize, type FeedEntry } from './collapse-runs';
import type { ActivityAction } from './event';

/**
 * How a feed entry reads: the action its line carries (a property run
 * collapses to its net change) and, for runs, the count suffix that follows
 * the entity ("5 times", "3 changes"). Singles carry no suffix.
 */
export function describeRun(entry: FeedEntry): {
  action: ActivityAction;
  countLabel: string | undefined;
} {
  const action = entryAction(entry);
  const size = entrySize(entry);
  if (size < 2) return { action, countLabel: undefined };
  return {
    action,
    countLabel:
      action.kind === 'property-changed'
        ? t('activity.countChanges', { count: size })
        : t('activity.countTimes', { count: size }),
  };
}

/**
 * Short verb phrase for one activity action, phrased to follow an actor
 * name: "Sarah <created this>". With a `count` of two or more the count is
 * folded into the phrase ("made 5 edits", "opened this 5 times") so a run
 * without a named entity never reads as "made an edit 5 times". Unknown
 * actions (rows written by a newer deployment) fall back to their humanized
 * raw tag rather than hiding the row.
 */
export function describeAction(action: ActivityAction, count = 1): string {
  if (count < 2) {
    return match(action)
      .with({ kind: 'task-added' }, () => t('activity.countedTaskAdded', { count: 1 }))
      .with({ kind: 'task-removed' }, () => t('activity.countedTaskRemoved', { count: 1 }))
      .with({ kind: 'created' }, () => t('activity.countedCreated', { count: 1 }))
      .with({ kind: 'edited' }, () => t('activity.countedEdited', { count: 1 }))
      .with({ kind: 'opened' }, () => t('activity.countedOpened', { count: 1 }))
      .with({ kind: 'deleted' }, () => t('activity.countedDeleted', { count: 1 }))
      .with({ kind: 'messaged' }, () => t('activity.countedMessaged', { count: 1 }))
      .with({ kind: 'email-sent' }, () => t('activity.countedEmailSent', { count: 1 }))
      .with({ kind: 'property-changed' }, () => t('activity.countedPropertyChanged', { count: 1 }))
      .with({ kind: 'participant-added' }, () => t('activity.countedParticipantAdded', { count: 1 }))
      .with({ kind: 'participant-removed' }, () => t('activity.countedParticipantRemoved', { count: 1 }))
      .with({ kind: 'call-started' }, () => t('activity.countedCallStarted', { count: 1 }))
      .with({ kind: 'responded' }, () => t('activity.countedResponded', { count: 1 }))
      .with({ kind: 'unknown' }, (unknown) => unknown.tag.replaceAll('_', ' '))
      .exhaustive();
  }
  return match(action)
    .with({ kind: 'task-added' }, () => t('activity.countedTaskAdded', { count }))
    .with({ kind: 'task-removed' }, () => t('activity.countedTaskRemoved', { count }))
    .with({ kind: 'created' }, () => t('activity.countedCreated', { count }))
    .with({ kind: 'edited' }, () => t('activity.countedEdited', { count }))
    .with({ kind: 'opened' }, () => t('activity.countedOpened', { count }))
    .with({ kind: 'deleted' }, () => t('activity.countedDeleted', { count }))
    .with({ kind: 'messaged' }, () => t('activity.countedMessaged', { count }))
    .with({ kind: 'email-sent' }, () => t('activity.countedEmailSent', { count }))
    .with({ kind: 'property-changed' }, () => t('activity.countedPropertyChanged', { count }))
    .with({ kind: 'participant-added' }, () => t('activity.countedParticipantAdded', { count }))
    .with({ kind: 'participant-removed' }, () => t('activity.countedParticipantRemoved', { count }))
    .with({ kind: 'call-started' }, () => t('activity.countedCallStarted', { count }))
    .with({ kind: 'responded' }, () => t('activity.countedResponded', { count }))
    .with({ kind: 'unknown' }, (unknown) =>
      t('activity.countedUnknown', {
        count,
        tag: unknown.tag.replaceAll('_', ' '),
      })
    )
    .exhaustive();
}

/**
 * The verb for a row that names its entity: "<actor> <verb> [connector]
 * <entity>". Direct-object actions carry no connector ("created *Doc*");
 * located actions carry the natural preposition ("sent a message *in*
 * #general", "changed Status *on* *Doc*").
 */
export function describeActionForEntity(action: ActivityAction): {
  verb: string;
  connector?: string;
} {
  return match(action)
    .with({ kind: 'task-added' }, () => ({
      verb: t('activity.verbAddedTask'),
      connector: t('activity.connectorTo'),
    }))
    .with({ kind: 'task-removed' }, () => ({
      verb: t('activity.verbRemovedTask'),
      connector: t('activity.connectorFrom'),
    }))
    .with({ kind: 'created' }, () => ({
      verb: t('activity.verbCreated'),
    }))
    .with({ kind: 'edited' }, () => ({ verb: t('activity.verbEdited') }))
    .with({ kind: 'opened' }, () => ({ verb: t('activity.verbOpened') }))
    .with({ kind: 'deleted' }, () => ({
      verb: t('activity.verbDeleted'),
    }))
    .with({ kind: 'messaged' }, () => ({
      verb: t('activity.verbMessaged'),
      connector: t('activity.connectorIn'),
    }))
    .with({ kind: 'email-sent' }, () => ({
      verb: t('activity.verbEmailSent'),
      connector: t('activity.connectorIn'),
    }))
    .with({ kind: 'property-changed' }, () => ({
      verb: t('activity.verbPropertyChanged'),
      connector: t('activity.connectorOn'),
    }))
    .with({ kind: 'participant-added' }, () => ({
      verb: t('activity.verbParticipantAdded'),
      connector: t('activity.connectorTo'),
    }))
    .with({ kind: 'participant-removed' }, () => ({
      verb: t('activity.verbParticipantRemoved'),
      connector: t('activity.connectorFrom'),
    }))
    .with({ kind: 'call-started' }, () => ({
      verb: t('activity.verbCallStarted'),
      connector: t('activity.connectorIn'),
    }))
    .with({ kind: 'responded' }, () => ({ verb: t('activity.verbResponded'),
      connector: t('activity.connectorTo'), }))
    .with({ kind: 'unknown' }, (unknown) => ({
      verb: unknown.tag.replaceAll('_', ' '),
      connector: t('activity.connectorOn'),
    }))
    .exhaustive();
}
