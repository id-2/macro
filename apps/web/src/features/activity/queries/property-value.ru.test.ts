import {
  interfaceLanguageReady,
  setInterfaceLanguage,
} from '@app/lib/i18n';
import { PROPERTY_OPTION_IDS } from '@property/constants';
import type { PropertyDefinitionDomain } from '@property/types';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  describeAction,
  describeActionForEntity,
} from '../core/describe-action';
import { propertyValueLabel, selectOptionEntries } from './property-value';

beforeAll(async () => {
  setInterfaceLanguage('ru');
  await interfaceLanguageReady(5000);
});

const statusDefinition = {
  id: 'status-definition',
  displayName: 'Статус',
  options: [
    {
      id: PROPERTY_OPTION_IDS.STATUS.NOT_STARTED,
      value: { type: 'string', value: 'Not Started' },
    },
  ],
} as unknown as PropertyDefinitionDomain;

describe('the activity feed in Russian', () => {
  it('writes the action phrases in Russian', () => {
    expect(describeAction({ kind: 'edited' })).toBe('сделал(а) изменение');
    expect(describeAction({ kind: 'property-changed' }, 2)).toBe(
      'изменил(а) 2 свойства'
    );
    expect(describeActionForEntity({ kind: 'created' })).toEqual({
      verb: 'создал(а)',
    });
  });

  it('names an unnamed referenced entity as an object', () => {
    expect(
      propertyValueLabel(
        {
          type: 'EntityReference',
          value: [{ entity_type: 'USER', entity_id: 'macro|bob@example.com' }],
        },
        undefined
      )
    ).toBe('объект');
    expect(
      propertyValueLabel(
        {
          type: 'EntityReference',
          value: [
            { entity_type: 'USER', entity_id: 'macro|bob@example.com' },
            { entity_type: 'USER', entity_id: 'macro|ann@example.com' },
          ],
        },
        undefined
      )
    ).toBe('2 объекта');
  });

  it('writes a known task status option in Russian', () => {
    const raw = {
      type: 'SelectOption',
      value: [PROPERTY_OPTION_IDS.STATUS.NOT_STARTED],
    };
    expect(selectOptionEntries(raw, statusDefinition)?.[0]?.label).toBe(
      'Не начато'
    );
    expect(propertyValueLabel(raw, statusDefinition)).toBe('Не начато');
  });

  it('writes a deadline as a Russian day, month and year', () => {
    expect(
      propertyValueLabel(
        { type: 'Date', value: '2026-11-23T12:00:00.000Z' },
        undefined
      )
    ).toBe('23 нояб. 2026 г.');
  });
});
