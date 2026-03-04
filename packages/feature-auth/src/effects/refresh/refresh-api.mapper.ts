/**
 * @file packages/feature-auth/src/effects/refresh/refresh-api.mapper.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Refresh API Mapper
 * ============================================================================
 * Назначение (только mapping, без orchestration):
 * - SessionState (domain) → RefreshTokenRequestValues (transport payload для `/v1/auth/refresh`)
 * - Tuple (LoginTokenPairValues, MeResponseValues?) → { tokenPair: TokenPair; me?: MeResponse } (domain)
 * Гарантии:
 * - ❌ Не содержит логики store/security/telemetry и не читает SessionManagerPort
 * - ✅ Fail-closed: строгая Zod-валидация DTO через схемы (`refreshTokenRequestSchema`, `loginTokenPairSchema`, `meResponseSchema`)
 * - ✅ Immutability: copy-on-write + `Object.freeze` (мутабельные ссылки из DTO не протекают в domain)
 * - ✅ Shared мэпперы для TokenPair/MeResponse (консистентность c login/register)
 * - ✅ Domain purity: работа только с domain/transport типами без доступа к инфраструктуре
 */

import type { MeResponse } from '../../domain/MeResponse.js';
import type { TokenPair } from '../../domain/TokenPair.js';
import type {
  LoginTokenPairValues,
  MeResponseValues,
  RefreshTokenRequestValues,
} from '../../schemas/index.js';
import {
  loginTokenPairSchema,
  meResponseSchema,
  refreshTokenRequestSchema,
} from '../../schemas/index.js';
import type { SessionState } from '../../types/auth.js';
import {
  mapMeResponseValuesToDomain,
  mapTokenPairValuesToDomain,
} from '../shared/auth-api.mappers.js';

/* ============================================================================
 * 🔧 DOMAIN-SPECIFIC ERRORS
 * ========================================================================== */

/**
 * Ошибка мэппинга refresh API.
 * @remarks Domain-specific error для security-critical эффекта, ограничивает scope stack trace.
 */
// eslint-disable-next-line functional/no-classes -- классы нужны для корректного stack trace и instanceof
export class RefreshApiMapperError extends Error {
  constructor(message: string) {
    super(message);
    // eslint-disable-next-line functional/no-this-expressions -- конструктор класса требует мутации this
    this.name = 'RefreshApiMapperError';
  }
}

/* ============================================================================
 * 🎯 PUBLIC API — REQUEST MAPPING
 * ========================================================================== */

/**
 * Маппинг SessionState (domain) → RefreshTokenRequestValues (transport для `/v1/auth/refresh`).
 * @remarks
 * - Domain SessionState сохраняет только сведения о сессии (без TokenPair).
 * - Refresh-effect получает refreshToken из хранилища отдельно (см. store-updater/орchestrator).
 * - Mapper принимает уже выделенный refreshToken и формирует валидированный transport payload.
 * @throws RefreshApiMapperError если `refreshToken` пустой.
 * @throws ZodError если payload не проходит Zod-валидацию (`refreshTokenRequestSchema`).
 */
export function mapRefreshRequestToApiPayload(
  _sessionState: Readonly<SessionState>, // зарезервировано для будущего расширения (audit/telemetry), сейчас не используется
  refreshToken: string,
): Readonly<RefreshTokenRequestValues> {
  if (typeof refreshToken !== 'string' || refreshToken.trim() === '') {
    throw new RefreshApiMapperError('[refresh-api.mapper] refreshToken must not be empty');
  }

  const raw: RefreshTokenRequestValues = {
    refreshToken,
  };

  // Zod-валидация transport payload (fail-closed)
  const parsed = refreshTokenRequestSchema.parse(raw);

  return Object.freeze(parsed);
}

/* ============================================================================
 * 🎯 PUBLIC API — RESPONSE MAPPING
 * ========================================================================== */

/**
 * Маппинг пары (LoginTokenPairValues, MeResponseValues?) → domain-результат для refresh-flow.
 * @remarks
 * - TokenPair маппится через shared `mapTokenPairValuesToDomain` (консистентность login/register/refresh).
 * - MeResponse маппится через shared `mapMeResponseValuesToDomain`, если `meDto` передан.
 * - Обе DTO-структуры валидируются через строгие Zod-схемы до маппинга.
 * - Все возвращаемые объекты замораживаются (`Object.freeze`).
 * @throws RefreshApiMapperError если `tokenPairDto` или `meDto` не проходят Zod-валидацию.
 */
export function mapRefreshResponseToDomain(
  tokenPairDto: Readonly<LoginTokenPairValues>,
  meDto?: Readonly<MeResponseValues>,
): Readonly<{
  tokenPair: Readonly<TokenPair>;
  me?: Readonly<MeResponse>;
}> {
  // Zod-валидация DTO (fail-closed) до маппинга в domain с обёрткой в domain-ошибку
  let validatedTokenPair: LoginTokenPairValues;
  let validatedMe: MeResponseValues | undefined;

  try {
    validatedTokenPair = loginTokenPairSchema.parse(tokenPairDto);
  } catch (e: unknown) {
    throw new RefreshApiMapperError(
      `[refresh-api.mapper] Invalid tokenPairDto: ${String(e)}`,
    );
  }

  try {
    validatedMe = meDto !== undefined ? meResponseSchema.parse(meDto) : undefined;
  } catch (e: unknown) {
    throw new RefreshApiMapperError(
      `[refresh-api.mapper] Invalid meDto: ${String(e)}`,
    );
  }

  const tokenPair = mapTokenPairValuesToDomain(validatedTokenPair);
  const me = validatedMe !== undefined ? mapMeResponseValuesToDomain(validatedMe) : undefined;

  return Object.freeze({
    tokenPair,
    ...(me !== undefined ? { me } : {}),
  });
}
