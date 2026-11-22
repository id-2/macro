import { describe, expect, it } from 'vitest';
import {
  extractSearchSnippet,
  extractSearchTerms,
  highlightTermsInText,
  mergeAdjacentMacroEmTags,
  parseSearchHighlightSegments,
  visibleLength,
  windowSearchMatch,
} from './searchHighlight';

describe('visibleLength', () => {
  it('counts visible characters excluding rox_em tags', () => {
    expect(visibleLength('hello')).toBe(5);
    expect(visibleLength('<rox_em>hello</rox_em>')).toBe(5);
    expect(visibleLength('the <rox_em>quick</rox_em> brown')).toBe(15);
  });

  it('strips invisible unicode characters', () => {
    expect(visibleLength('hello\u200Bworld')).toBe(10);
    expect(visibleLength('\u200B\u200F')).toBe(0);
  });

  it('collapses whitespace and newlines', () => {
    expect(visibleLength('hello\n\n  world')).toBe(11);
  });
});

describe('extractSearchTerms', () => {
  it('extracts terms from rox_em tags', () => {
    expect(
      extractSearchTerms(
        'The <rox_em>quick</rox_em> brown <rox_em>fox</rox_em>'
      )
    ).toEqual(['quick', 'fox']);
  });

  it('returns empty array when no tags', () => {
    expect(extractSearchTerms('no highlights here')).toEqual([]);
  });

  it('handles adjacent tags', () => {
    expect(
      extractSearchTerms(
        '<rox_em>hello</rox_em> <rox_em>world</rox_em>'
      )
    ).toEqual(['hello', 'world']);
  });

  it('trims whitespace inside tags', () => {
    expect(extractSearchTerms('<rox_em> padded </rox_em>')).toEqual([
      'padded',
    ]);
  });
});

describe('extractSearchSnippet', () => {
  it('removes rox_em tags and normalizes whitespace', () => {
    expect(
      extractSearchSnippet('The <rox_em>quick</rox_em>\n  brown   fox')
    ).toBe('The quick brown fox');
  });

  it('returns plain text unchanged', () => {
    expect(extractSearchSnippet('hello world')).toBe('hello world');
  });

  it('handles empty string', () => {
    expect(extractSearchSnippet('')).toBe('');
  });
});

describe('mergeAdjacentMacroEmTags', () => {
  it('merges adjacent tags separated by whitespace', () => {
    expect(
      mergeAdjacentMacroEmTags(
        'The <rox_em>quick</rox_em> <rox_em>brown</rox_em> fox'
      )
    ).toBe('The <rox_em>quick brown</rox_em> fox');
  });

  it('does not merge tags separated by non-whitespace', () => {
    expect(
      mergeAdjacentMacroEmTags(
        '<rox_em>Hello</rox_em>, <rox_em>world</rox_em>'
      )
    ).toBe('<rox_em>Hello</rox_em>, <rox_em>world</rox_em>');
  });

  it('merges multiple adjacent tags', () => {
    expect(
      mergeAdjacentMacroEmTags(
        '<rox_em>a</rox_em> <rox_em>b</rox_em> <rox_em>c</rox_em>'
      )
    ).toBe('<rox_em>a b c</rox_em>');
  });

  it('returns text without tags unchanged', () => {
    expect(mergeAdjacentMacroEmTags('no tags here')).toBe('no tags here');
  });
});

describe('highlightTermsInText', () => {
  it('wraps matching terms in rox_em tags', () => {
    expect(highlightTermsInText('hello world', ['hello'])).toBe(
      '<rox_em>hello</rox_em> world'
    );
  });

  it('is case-insensitive', () => {
    expect(highlightTermsInText('Hello World', ['hello'])).toBe(
      '<rox_em>Hello</rox_em> World'
    );
  });

  it('highlights multiple terms', () => {
    expect(highlightTermsInText('the quick brown fox', ['quick', 'fox'])).toBe(
      'the <rox_em>quick</rox_em> brown <rox_em>fox</rox_em>'
    );
  });

  it('returns text unchanged when no terms', () => {
    expect(highlightTermsInText('hello', [])).toBe('hello');
  });

  it('escapes regex special characters in terms', () => {
    expect(highlightTermsInText('price is $10.00', ['$10.00'])).toBe(
      'price is <rox_em>$10.00</rox_em>'
    );
  });
});

describe('windowSearchMatch', () => {
  it('returns full text when highlight is near the start', () => {
    expect(windowSearchMatch('<rox_em>hello</rox_em> world', 50)).toBe(
      '<rox_em>hello</rox_em> world'
    );
  });

  it('trims front when highlight is far from start', () => {
    const longPrefix = 'a '.repeat(50);
    const text = `${longPrefix}<rox_em>match</rox_em> end`;
    const result = windowSearchMatch(text, 10);
    expect(result.length).toBeLessThan(text.length);
    expect(result).toContain('<rox_em>match</rox_em>');
  });

  it('trims end when text after highlight is long', () => {
    const longSuffix = ' b'.repeat(50);
    const text = `<rox_em>match</rox_em>${longSuffix}`;
    const result = windowSearchMatch(text, 10);
    expect(result.length).toBeLessThan(text.length);
    expect(result).toContain('<rox_em>match</rox_em>');
  });

  it('returns text as-is when no rox_em tag present', () => {
    expect(windowSearchMatch('no highlight here', 20)).toBe(
      'no highlight here'
    );
  });

  it('donates unused front budget to back when highlight is at start', () => {
    const longSuffix = 'b '.repeat(40);
    const text = `<rox_em>match</rox_em> ${longSuffix}`;
    const result = windowSearchMatch(text, 10);
    expect(result).toContain('<rox_em>match</rox_em>');
    const visibleAfter = result
      .slice(result.lastIndexOf('</rox_em>') + '</rox_em>'.length)
      .trim().length;
    expect(visibleAfter).toBeGreaterThan(10);
    expect(visibleAfter).toBeLessThanOrEqual(20);
  });

  it('donates unused back budget to front when highlight is at end', () => {
    const longPrefix = 'a '.repeat(40);
    const text = `${longPrefix}<rox_em>match</rox_em>`;
    const result = windowSearchMatch(text, 10);
    expect(result).toContain('<rox_em>match</rox_em>');
    const visibleBefore = result
      .slice(0, result.indexOf('<rox_em>'))
      .trim().length;
    expect(visibleBefore).toBeGreaterThan(10);
    expect(visibleBefore).toBeLessThanOrEqual(20);
  });
});

describe('parseSearchHighlightSegments', () => {
  it('parses mixed content into segments', () => {
    expect(
      parseSearchHighlightSegments(
        'The <rox_em>quick</rox_em> brown <rox_em>fox</rox_em>'
      )
    ).toEqual([
      { text: 'The ', highlight: false },
      { text: 'quick', highlight: true },
      { text: ' brown ', highlight: false },
      { text: 'fox', highlight: true },
    ]);
  });

  it('handles text with no highlights', () => {
    expect(parseSearchHighlightSegments('plain text')).toEqual([
      { text: 'plain text', highlight: false },
    ]);
  });

  it('handles fully highlighted text', () => {
    expect(parseSearchHighlightSegments('<rox_em>all</rox_em>')).toEqual([
      { text: 'all', highlight: true },
    ]);
  });

  it('handles empty string', () => {
    expect(parseSearchHighlightSegments('')).toEqual([]);
  });
});
