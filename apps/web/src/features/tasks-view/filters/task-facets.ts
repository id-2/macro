import {
  clause,
  EMPTY_TAG_FACET_CONTEXT,
  type Facet,
  type FacetClause,
  type FacetOption,
  type FacetSelection,
  resolveFacetOption,
  TAG_FACET_ID,
  type TagFacetContext,
  tagFacetOption,
} from '@app/features/soup/filters/facets';
import type { TaskEntityWithProperties } from '@entity/types/entity';
import {
  getTaskAssigneeIds,
  getTaskPriorityOptionId,
  getTaskStatusOptionId,
} from '@entity/utils/task-properties';
import { PROPERTY_OPTION_IDS, SYSTEM_PROPERTY_IDS } from '@property/constants';
import { z } from 'zod';

export const TASK_VIEWER = '@viewer';

export type TaskFacetContext = TagFacetContext & { viewerId?: string };

export const resolveTaskPersonId = (id: string, context: TaskFacetContext) =>
  id === TASK_VIEWER
    ? (context.viewerId ?? '00000000-0000-0000-0000-000000000000')
    : id;

export const EMPTY_TASK_FACET_CONTEXT: TaskFacetContext =
  EMPTY_TAG_FACET_CONTEXT;

export type TaskFacetOption = FacetOption<
  TaskEntityWithProperties,
  TaskFacetContext
> & {
  label?: string;
  propertyDefinitionId?: string;
  propertyOptionId?: string;
  propertyEntityId?: string;
};

type TaskPropertyFacetOption = TaskFacetOption & {
  label: string;
  propertyDefinitionId: string;
  propertyOptionId: string;
};

const propertyClause = (
  propertyDefinitionId: string,
  type: 'select' | 'entity',
  value: string
): FacetClause => ({
  propf: clause.eq('properties', {
    propertyId: propertyDefinitionId,
    type,
    value,
  }),
});

const statusOption = (
  id: string,
  label: string,
  propertyOptionId: string
): TaskPropertyFacetOption => ({
  id,
  label,
  propertyDefinitionId: SYSTEM_PROPERTY_IDS.STATUS,
  propertyOptionId,
  clause: propertyClause(
    SYSTEM_PROPERTY_IDS.STATUS,
    'select',
    propertyOptionId
  ),
  predicate: (task) => getTaskStatusOptionId(task) === propertyOptionId,
});

const priorityOption = (
  id: string,
  label: string,
  propertyOptionId: string
): TaskPropertyFacetOption => ({
  id,
  label,
  propertyDefinitionId: SYSTEM_PROPERTY_IDS.PRIORITY,
  propertyOptionId,
  clause: propertyClause(
    SYSTEM_PROPERTY_IDS.PRIORITY,
    'select',
    propertyOptionId
  ),
  predicate: (task) => getTaskPriorityOptionId(task) === propertyOptionId,
});

const assigneeOption = (id: string): TaskFacetOption => ({
  id,
  propertyDefinitionId: SYSTEM_PROPERTY_IDS.ASSIGNEES,
  propertyEntityId: id,
  clause: propertyClause(SYSTEM_PROPERTY_IDS.ASSIGNEES, 'entity', id),
  predicate: (task) => getTaskAssigneeIds(task).includes(id),
});

const creatorOption = (id: string): TaskFacetOption => ({
  id,
  clause: { df: clause.eq('documentOwnerId', id) },
  predicate: (task) => task.ownerId === id,
});

const tagOption = (
  id: string,
  context: TaskFacetContext
): TaskFacetOption | undefined =>
  tagFacetOption<TaskEntityWithProperties>(id, context);

export const TASK_STATUS_OPTIONS = [
  statusOption(
    'not-started',
    'Не начато',
    PROPERTY_OPTION_IDS.STATUS.NOT_STARTED
  ),
  statusOption(
    'in-progress',
    'В работе',
    PROPERTY_OPTION_IDS.STATUS.IN_PROGRESS
  ),
  statusOption('in-review', 'На проверке', PROPERTY_OPTION_IDS.STATUS.IN_REVIEW),
  statusOption('completed', 'Завершено', PROPERTY_OPTION_IDS.STATUS.COMPLETED),
  statusOption('canceled', 'Отменено', PROPERTY_OPTION_IDS.STATUS.CANCELED),
];

export const TASK_PRIORITY_OPTIONS = [
  priorityOption('urgent', 'Срочно', PROPERTY_OPTION_IDS.PRIORITY.URGENT),
  priorityOption('high', 'Высокий', PROPERTY_OPTION_IDS.PRIORITY.HIGH),
  priorityOption('medium', 'Средний', PROPERTY_OPTION_IDS.PRIORITY.MEDIUM),
  priorityOption('low', 'Низкий', PROPERTY_OPTION_IDS.PRIORITY.LOW),
];

export const TASK_FACETS: Facet<
  TaskEntityWithProperties,
  TaskFacetContext,
  TaskFacetOption
>[] = [
  {
    id: 'status',
    mode: 'or',
    options: (id) =>
      TASK_STATUS_OPTIONS.find((option) => option.id === id) ??
      (z.string().guid().safeParse(id).success
        ? statusOption(id, 'Статус недоступен', id)
        : undefined),
  },
  {
    id: 'priority',
    mode: 'or',
    options: (id) =>
      TASK_PRIORITY_OPTIONS.find((option) => option.id === id) ??
      (z.string().guid().safeParse(id).success
        ? priorityOption(id, 'Приоритет недоступен', id)
        : undefined),
  },
  {
    id: 'assignees',
    mode: 'or',
    options: (id, context) => assigneeOption(resolveTaskPersonId(id, context)),
  },
  {
    id: 'created-by',
    mode: 'or',
    options: (id, context) => creatorOption(resolveTaskPersonId(id, context)),
  },
  { id: TAG_FACET_ID, mode: 'or', options: tagOption },
];

export const DEFAULT_TASK_FACET_SELECTION: FacetSelection = {
  status: ['in-progress', 'in-review', 'not-started'],
};

export const getTaskFacetOption = (
  facetId: string,
  optionId: string,
  context: TaskFacetContext
): TaskFacetOption | undefined => {
  const facet = TASK_FACETS.find((candidate) => candidate.id === facetId);
  if (!facet) return undefined;
  return resolveFacetOption(facet, optionId, context);
};
