'use strict';

const { mergeParamsBatch, splitBatchBody } = require('./inject-script/sinatra');

describe('splitBatchBody', () => {
  test('linha única sem newline', () => {
    expect(splitBatchBody('en=page_view')).toEqual(['en=page_view']);
  });
  test('múltiplas linhas separadas por \\n (batch do gtag.js)', () => {
    expect(splitBatchBody('en=page_view&dl=x\nen=session_start&_ss=1')).toEqual([
      'en=page_view&dl=x',
      'en=session_start&_ss=1'
    ]);
  });
  test('ignora linhas em branco', () => {
    expect(splitBatchBody('en=page_view\n\nen=session_start&_ss=1\n')).toEqual([
      'en=page_view',
      'en=session_start&_ss=1'
    ]);
  });
  test('body vazio ou nulo retorna array com string vazia', () => {
    expect(splitBatchBody('')).toEqual(['']);
    expect(splitBatchBody(null)).toEqual(['']);
  });
});

describe('mergeParamsBatch', () => {
  test('body com um único evento retorna array de 1', () => {
    const result = mergeParamsBatch(
      'https://www.google-analytics.com/g/collect?v=2&tid=G-XXXX&cid=111.222',
      'en=page_view&dl=https%3A%2F%2Fexample.com'
    );
    expect(result).toHaveLength(1);
    expect(result[0].en).toBe('page_view');
    expect(result[0].tid).toBe('G-XXXX');
  });

  test('body batchado (page_view + session_start) vira dois eventos, cada um com os params da URL', () => {
    const result = mergeParamsBatch(
      'https://www.google-analytics.com/g/collect?v=2&tid=G-XXXX&cid=111.222&sid=999',
      'en=page_view&dl=https%3A%2F%2Fexample.com\nen=session_start&_ss=1'
    );
    expect(result).toHaveLength(2);

    expect(result[0].en).toBe('page_view');
    expect(result[0].dl).toBe('https://example.com');
    expect(result[0].tid).toBe('G-XXXX');
    expect(result[0].sid).toBe('999');

    expect(result[1].en).toBe('session_start');
    expect(result[1]._ss).toBe('1');
    expect(result[1].tid).toBe('G-XXXX');
    expect(result[1].sid).toBe('999');
  });

  test('batch com três eventos (page_view + session_start + first_visit)', () => {
    const result = mergeParamsBatch(
      'https://www.google-analytics.com/g/collect?tid=G-XXXX',
      'en=page_view\nen=session_start&_ss=1\nen=first_visit&_fv=1'
    );
    expect(result.map((r) => r.en)).toEqual(['page_view', 'session_start', 'first_visit']);
  });

  test('body vazio retorna array de 1 só com params da URL', () => {
    const result = mergeParamsBatch('https://example.com/g/collect?cid=111', null);
    expect(result).toHaveLength(1);
    expect(result[0].cid).toBe('111');
  });
});
