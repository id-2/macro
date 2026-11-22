import { describe, expect, test } from 'bun:test';
import { Rox, Rox } from '../src/macro';

describe('Rox client class', () => {
  test('is exported under the new name with Rox kept as an alias', () => {
    expect(Rox.name).toBe('Rox');
    expect(Rox).toBe(Rox);
  });

  test('constructs under the new name', () => {
    expect(new Rox({ token: 'fixture' })).toBeInstanceOf(Rox);
  });
});
