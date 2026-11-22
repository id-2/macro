import { cleanup, render } from '@solidjs/testing-library';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { setInterfaceLanguage } from '@app/lib/i18n';
import { PropertyChangeText } from './property-change';

vi.mock('@property/component/propertyValue/PropertyValueIcon', () => ({
  PropertyValueIcon: () => null,
}));
vi.mock('@property/tags/TagDot', () => ({ TagDot: () => null }));
beforeAll(() => setInterfaceLanguage('en'));
afterEach(cleanup);
it('uses host-resolved labels even when the generic property formatter cannot name the values', () => {
  const from = { collaboratorId: 'first' };
  const to = { collaboratorId: 'second' };
  const view = render(() => (
    <PropertyChangeText
      action={{ kind: 'property-changed', property: 'collaborators', from, to }}
      definition={undefined}
      valueLabel={(raw) =>
        raw === from ? 'Alice' : raw === to ? 'Bob' : undefined
      }
    />
  ));
  expect(view.getByText('from')).toBeTruthy();
  expect(view.getByText('Alice')).toBeTruthy();
  expect(view.getByText('to')).toBeTruthy();
  expect(view.getByText('Bob')).toBeTruthy();
});
it('does not render a destination when the value was cleared', () => {
  const view = render(() => (
    <PropertyChangeText
      action={{ kind: 'property-changed', property: 'x', from: {}, to: null }}
      definition={undefined}
      valueLabel={() => 'Alice'}
    />
  ));
  expect(view.getByText('cleared')).toBeTruthy();
  expect(view.getByText('Alice')).toBeTruthy();
  expect(view.queryByText('to')).toBeNull();
});
