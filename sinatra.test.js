'use strict';

const { isGA4, parseQS, mergeParams } = require('./inject-script/sinatra');

describe('isGA4', () => {
  test('matches GA4 collect URL (google-analytics.com)', () => {
    expect(isGA4('https://www.google-analytics.com/g/collect?v=2&tid=G-XXXX')).toBe(true);
  });
  test('matches sGTM URL (/g/collect com tid=G-)', () => {
    expect(isGA4('https://server-side-tagging-l27fk7i2hq-uc.a.run.app/g/collect?v=2&tid=G-89WKR9H67X&en=page_view')).toBe(true);
  });
  test('does not match /g/collect sem tid=G- (não é GA4)', () => {
    expect(isGA4('https://example.com/g/collect?foo=bar')).toBe(false);
  });
  test('does not match Sinatra endpoint', () => {
    expect(isGA4('https://integrations.sinatra.pro/analytics/webhooks/events')).toBe(false);
  });
  test('does not match other URLs', () => {
    expect(isGA4('https://example.com/page')).toBe(false);
  });
  test('returns false for non-string', () => {
    expect(isGA4(null)).toBe(false);
    expect(isGA4(undefined)).toBe(false);
  });
});

describe('parseQS', () => {
  test('parses simple key=value pairs', () => {
    expect(parseQS('a=1&b=2')).toEqual({ a: '1', b: '2' });
  });
  test('handles leading ?', () => {
    expect(parseQS('?en=page_view&cid=111')).toEqual({ en: 'page_view', cid: '111' });
  });
  test('decodes URI components', () => {
    expect(parseQS('dl=https%3A%2F%2Fexample.com%2Fpage')).toEqual({ dl: 'https://example.com/page' });
  });
  test('decodes + as space', () => {
    expect(parseQS('dt=My+Page')).toEqual({ dt: 'My Page' });
  });
  test('returns empty object for empty string', () => {
    expect(parseQS('')).toEqual({});
  });
  test('returns empty object for null', () => {
    expect(parseQS(null)).toEqual({});
  });
});

describe('mergeParams', () => {
  test('merges URL params and body params', () => {
    const result = mergeParams(
      'https://www.google-analytics.com/g/collect?v=2&tid=G-XXXX&cid=111.222',
      'en=page_view&dl=https%3A%2F%2Fexample.com'
    );
    expect(result.tid).toBe('G-XXXX');
    expect(result.cid).toBe('111.222');
    expect(result.en).toBe('page_view');
    expect(result.dl).toBe('https://example.com');
  });
  test('body params override URL params when keys collide', () => {
    const result = mergeParams(
      'https://www.google-analytics.com/g/collect?cid=old',
      'cid=new'
    );
    expect(result.cid).toBe('new');
  });
  test('handles URL with no query string', () => {
    const result = mergeParams('https://www.google-analytics.com/g/collect', 'en=test');
    expect(result.en).toBe('test');
  });
  test('handles empty body', () => {
    const result = mergeParams('https://example.com/g/collect?cid=111', null);
    expect(result.cid).toBe('111');
  });
});

