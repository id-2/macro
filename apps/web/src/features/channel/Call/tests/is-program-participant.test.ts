import { describe, expect, it } from 'vitest';
import { isProgramParticipant } from '../is-program-participant';

describe('isProgramParticipant', () => {
  it('recognizes program participants by their LiveKit attribute', () => {
    expect(isProgramParticipant({ 'rox.program': 'agent' })).toBe(true);
    expect(isProgramParticipant({ 'rox.program': 'api_key' })).toBe(true);
    expect(isProgramParticipant({ 'rox.program': 'bot' })).toBe(true);
  });

  it('leaves people without a program attribute unmarked', () => {
    expect(isProgramParticipant(undefined)).toBe(false);
    expect(isProgramParticipant({})).toBe(false);
    expect(isProgramParticipant({ 'rox.program': '' })).toBe(false);
  });
});
