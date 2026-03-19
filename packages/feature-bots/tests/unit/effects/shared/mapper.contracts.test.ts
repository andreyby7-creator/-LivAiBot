/**
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import type { ParseIssue } from '../../../../src/effects/shared/mapper.contracts.js';
import { mapperErrorCodeParsingJsonInvalid } from '../../../../src/effects/shared/mapper.contracts.js';

type Assert<T extends true> = T;
type Extends<A, B> = A extends B ? true : false;

describe('mapper.contracts', () => {
  it('экспортирует канонический mapping error code', () => {
    expect(mapperErrorCodeParsingJsonInvalid).toBe('BOT_PARSING_JSON_INVALID');
  });

  it('ParseIssue: содержит path и message как string', () => {
    const _issue: Assert<Extends<ParseIssue, { path: string; message: string; }>> = true;
    void _issue;
  });
});
