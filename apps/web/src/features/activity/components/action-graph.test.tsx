import { setInterfaceLanguage } from '@app/lib/i18n';
import { cleanup, render } from '@solidjs/testing-library';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { ActionGraph } from './action-graph';

beforeAll(() => setInterfaceLanguage('ru'));
beforeEach(() => {
  // jsdom has no layout, so the measured heatmap area never resizes.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** A quiet year: no actions, so only the axis carries text. */
const YEAR = {
  from: '2026-01-01',
  to: '2027-01-01',
  timeZone: 'UTC',
  total: 0,
  days: [],
  topEntities: [],
};

describe('ActionGraph axis labels', () => {
  it('writes readable Russian months and two-letter weekdays', () => {
    const view = render(() => <ActionGraph overview={YEAR} />);

    expect(view.getByText('янв.')).toBeTruthy();
    expect(view.getByText('фев.')).toBeTruthy();
    expect(view.getByText('ноя.')).toBeTruthy();
    expect(view.getByText('Пн')).toBeTruthy();
    expect(view.getByText('Ср')).toBeTruthy();
    expect(view.getByText('Пт')).toBeTruthy();
  });

  it('keeps the statistics month name spelled out', () => {
    const view = render(() => (
      <ActionGraph
        overview={{
          ...YEAR,
          total: 3,
          days: [{ date: '2026-11-02', count: 3 }],
        }}
      />
    ));

    expect(view.getByText('Ноябрь')).toBeTruthy();
  });
});
