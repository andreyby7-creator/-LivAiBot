/**
 * @file packages/feature-auth/src/effects/register/register-metadata.enricher.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Register Metadata Enricher
 * ============================================================================
 *
 * Minimal, deterministic metadata builder for register-flow.
 * Keeps register independent from login-specific abstractions.
 */

import type { RegisterIdentifierType, RegisterRequest } from '../../dto/RegisterRequest.js';

export type RegisterMetadataVersion = '1';

export type RegisterIdentifierHasher = (value: string) => string;

export type RegisterMetadata =
  | Readonly<{ v: RegisterMetadataVersion; type: 'trace'; traceId: string; }>
  | Readonly<{
    v: RegisterMetadataVersion;
    type: 'identifier';
    identifierType: RegisterIdentifierType;
    identifierHash: string;
  }>
  | Readonly<
    { v: RegisterMetadataVersion; type: 'timestamp'; timestamp: string; operation: 'register'; }
  >;

export type RegisterMetadataContext = Readonly<{
  request: RegisterRequest<RegisterIdentifierType>;
  traceId: string;
  timestamp: string;
}>;

export type RegisterMetadataConfig = Readonly<{
  /**
   * Crypto-safe identifier hasher (например HMAC-SHA256) для защиты PII.
   * @note Должен быть детерминированным и криптографически стойким.
   */
  identifierHasher: RegisterIdentifierHasher;
}>;

export function buildRegisterMetadata(
  context: RegisterMetadataContext,
  config: RegisterMetadataConfig,
): readonly RegisterMetadata[] {
  const version: RegisterMetadataVersion = '1';

  const identifierValue = context.request.identifier.value;
  if (identifierValue.trim() === '') {
    throw new Error('[register-metadata] Invalid identifier.value: must be a non-empty string');
  }
  if (context.traceId.trim() === '') {
    throw new Error('[register-metadata] Invalid traceId: must be a non-empty string');
  }
  if (context.timestamp.trim() === '') {
    throw new Error('[register-metadata] Invalid timestamp: must be a non-empty string');
  }

  const identifierHash = config.identifierHasher(identifierValue);
  if (typeof identifierHash !== 'string' || identifierHash.trim() === '') {
    throw new Error('[register-metadata] Invalid identifierHash: hasher returned empty value');
  }

  return Object.freeze([
    Object.freeze({ v: version, type: 'trace', traceId: context.traceId }),
    Object.freeze({
      v: version,
      type: 'identifier',
      identifierType: context.request.identifier.type,
      identifierHash,
    }),
    Object.freeze({
      v: version,
      type: 'timestamp',
      timestamp: context.timestamp,
      operation: 'register',
    }),
  ]);
}
