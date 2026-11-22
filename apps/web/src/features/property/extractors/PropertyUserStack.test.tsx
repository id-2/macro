import { cleanup, render } from '@solidjs/testing-library';
import { createSignal, type JSX } from 'solid-js';
import { afterEach, expect, it, vi } from 'vitest';
import type { EntityProperty } from '../types';
import { PropertyUserStack } from './PropertyUserStack';

const avatars = vi.hoisted(() => ({ mounts: [] as string[] }));

vi.mock('@core/component/UserIcon', () => ({
  UserIcon: (props: { id: string }) => {
    avatars.mounts.push(props.id);
    return <span>{props.id}</span>;
  },
}));
vi.mock('@ui', () => ({
  AvatarGroup: Object.assign(
    (props: { children: JSX.Element }) => <div>{props.children}</div>,
    {
      Count: (props: { children: JSX.Element }) => (
        <span>{props.children}</span>
      ),
    }
  ),
}));

const assignees: EntityProperty = {
  propertyId: 'task-assignees',
  propertyDefinitionId: 'assignees-definition',
  displayName: 'Assignees',
  isMultiSelect: true,
  owner: { scope: 'system' },
  createdAt: new Date(0),
  updatedAt: new Date(0),
  valueType: 'ENTITY',
  specificEntityType: 'USER',
  value: [
    { entity_id: 'rox|alice@example.com', entity_type: 'USER' },
    { entity_id: 'rox|bob@example.com', entity_type: 'USER' },
  ],
};

afterEach(() => {
  cleanup();
  avatars.mounts = [];
});

it('keeps each avatar in place while the assignees re-emit', () => {
  const [property, setProperty] = createSignal(assignees);
  const view = render(() => <PropertyUserStack property={property()} />);
  const alice = view.getByText('rox|alice@example.com');

  setProperty({
    ...assignees,
    value: [
      { entity_id: 'rox|alice@example.com', entity_type: 'USER' },
      { entity_id: 'rox|bob@example.com', entity_type: 'USER' },
      { entity_id: 'rox|carol@example.com', entity_type: 'USER' },
    ],
  });

  expect(view.getByText('rox|alice@example.com')).toBe(alice);
  expect(avatars.mounts).toEqual([
    'rox|alice@example.com',
    'rox|bob@example.com',
    'rox|carol@example.com',
  ]);
});
