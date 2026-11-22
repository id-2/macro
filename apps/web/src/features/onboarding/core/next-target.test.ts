import { describe, expect, it } from 'vitest';
import {
  afterOnboardingTarget,
  onboardingPathWithStep,
  sanitizeNext,
} from './next-target';

describe('sanitizeNext', () => {
  it.each([
    ['/channel/abc', '/channel/abc'],
    ['/md/1?x=2', '/md/1?x=2'],
    ['//evil.com', undefined],
    ['https://evil.com', undefined],
    ['/a\\b', undefined],
    ['/home', undefined],
    ['/home/inbox', undefined],
    [undefined, undefined],
    [['/channel/abc'], undefined],
  ])('%o → %o', (value, expected) => {
    expect(sanitizeNext(value)).toBe(expected);
  });
});

describe('afterOnboardingTarget', () => {
  it('prefers the first valid deep link', () => {
    expect(afterOnboardingTarget('/home', '/channel/x', '/md/y')).toBe(
      '/channel/x'
    );
  });

  it('falls back to Home', () => {
    expect(afterOnboardingTarget(undefined, '//evil.com')).toBe('/home');
  });
});

describe('onboarding entry links', () => {
  it('keeps a validated step on the onboarding path', () => {
    expect(onboardingPathWithStep('plan')).toBe('/onboarding?step=plan');
    expect(onboardingPathWithStep(['work'])).toBe('/onboarding?step=work');
    expect(onboardingPathWithStep('email')).toBe('/onboarding');
    expect(onboardingPathWithStep(undefined)).toBe('/onboarding');
  });
});
