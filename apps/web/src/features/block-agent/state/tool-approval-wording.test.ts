import { describe, expect, it } from 'vitest';
import {
  describeStandingApproval,
  describeToolCall,
  possessive,
} from './tool-approval-wording';

const rox = { slug: 'rox', name: 'Rox' };

describe('describeToolCall', () => {
  it("says what one of Rox's tools does with the owner's data", () => {
    expect(describeToolCall(rox, 'GetThread', 'your')).toBe(
      'read your email'
    );
    expect(describeToolCall(rox, 'CreateCalendarEvent', "Alice's")).toBe(
      "add an event to Alice's calendar"
    );
  });

  it('falls back to the tool name in words', () => {
    expect(describeToolCall(rox, 'NewerThanThisBuild', 'your')).toBe(
      'use your Rox workspace (newer than this build)'
    );
    expect(
      describeToolCall(
        { slug: 'linear', name: 'Linear' },
        'linear-create-issue',
        'your'
      )
    ).toBe('use your Linear account (linear create issue)');
  });
});

describe('describeStandingApproval', () => {
  it("covers one of Rox's tools, or a whole connected app", () => {
    expect(describeStandingApproval(rox, 'GetThread', 'your')).toBe(
      'read your email'
    );
    expect(
      describeStandingApproval(
        { slug: 'linear', name: 'Linear' },
        'linear-create-issue',
        'your'
      )
    ).toBe('use your Linear account');
  });
});

describe('possessive', () => {
  it('adds an apostrophe s, or just an apostrophe after an s', () => {
    expect(possessive('Alice Seed')).toBe("Alice Seed's");
    expect(possessive('James')).toBe("James'");
  });
});
