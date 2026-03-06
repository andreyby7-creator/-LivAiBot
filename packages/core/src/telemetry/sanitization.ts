/**
 * @file @livai/core/src/telemetry/sanitization.ts
 * ============================================================================
 * 🔒 SANITIZATION — ДЕТЕКТ PII И ОЧИСТКА (SANITIZATION) METADATA
 * ============================================================================
 *
 * ВАЖНЫЕ АРХИТЕКТУРНЫЕ ОГРАНИЧЕНИЯ:
 * - Должен оставаться чистым util-модулем
 * - Никаких побочных эффектов (никаких console.log, глобального состояния, синглтонов)
 * - Никаких импортов из runtime-модулей (client, batch-core)
 * - Зависит только от типов из core-contracts
 *
 * Это предотвращает циклические зависимости и сохраняет переиспользуемость логики очистки.
 */

import type { TelemetryEvent, TelemetryMetadata } from '@livai/core-contracts';

/* ============================================================================
 * 🔧 КОНСТАНТЫ
 * ============================================================================
 */

/**
 * ВАЖНО: PII-детект на основе регулярных выражений даёт пропуски и не рекомендуется для продакшена.
 * Для высоких требований к безопасности используйте:
 * - схему с белым списком (разрешённые поля) через типизированные контракты metadata
 * - Явную валидацию через sanitizeMetadata в конфиге
 * Regex-подход оставлен только для обратной совместимости и должен быть отключен
 * через enableRegexPIIDetection: false в продакшене.
 */
const PII_PATTERNS = Object.freeze(
  [
    /^(password|pwd|passwd)$/i,
    /^(access[_-]?token|auth[_-]?token|bearer[_-]?token|refresh[_-]?token)$/i,
    /^(jwt)$/i,
    /^(id[_-]?token)$/i,
    /^(secret|secret[_-]?key|private[_-]?key)$/i,
    /^(client[_-]?secret)$/i,
    /^(credential|credentials)$/i,
    /^(api[_-]?key|apikey)$/i,
    /^(authorization|auth[_-]?header)$/i,
    /^(credit[_-]?card|card[_-]?number|cc[_-]?number)$/i,
    /^(ssn|social[_-]?security[_-]?number)$/i,
    /^(session[_-]?id|sessionid)$/i,
  ] as const,
);

const MIN_BASE64_TOKEN_LENGTH = 20;

// Константа-лимит для обрезки строк (не пользовательские данные)
// eslint-disable-next-line ai-security/model-poisoning -- Константа-лимит для обрезки строк (не пользовательские данные)
const MAX_METADATA_STRING_LENGTH = 1000;
const REDACTED = '[REDACTED]';

/* ============================================================================
 * 🔒 ДЕТЕКТ PII (ВНУТРЕННЕЕ)
 * ============================================================================
 */

/**
 * Проверяет, является ли строка base64-закодированным токеном.
 * ВАЖНО: Это эвристика с пропусками. Используйте типизированные контракты metadata для продакшена.
 */
function isBase64Token(value: string): boolean {
  if (value.length < MIN_BASE64_TOKEN_LENGTH) return false;
  // Base64 может содержать A-Z, a-z, 0-9, +, /, = (padding)
  const base64Pattern = /^[A-Za-z0-9+/]+=*$/;
  return base64Pattern.test(value);
}

/** Проверяет, является ли ключ PII-полем. */
function isPIIKey(key: string): boolean {
  return PII_PATTERNS.some((pattern) => pattern.test(key));
}

/** Проверяет, содержит ли значение PII. */
function isPIIValue(value: string): boolean {
  return PII_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Middleware для скрытия PII на уровне core.
 * Гарантирует, что ни одно событие не попадет с чувствительными данными до отправки.
 * @param metadata - Метаданные для проверки
 * @param deep - Включить глубокую рекурсивную проверку (по умолчанию false для производительности)
 * @returns true если обнаружен PII
 */
function containsPII(
  metadata: TelemetryMetadata | undefined,
  deep = false,
): boolean {
  if (!metadata) {
    return false;
  }

  return Object.entries(metadata).some(([key, value]) => {
    // Проверка ключа на PII patterns (всегда включена)
    if (isPIIKey(key)) {
      return true;
    }

    // Проверка значения на PII patterns (если строка)
    if (typeof value === 'string' && isPIIValue(value)) {
      return true;
    }

    // Рекурсивная проверка вложенных объектов (опционально)
    return deep
      && value !== null
      && typeof value === 'object'
      && !Array.isArray(value)
      && containsPII(value as TelemetryMetadata, true);
  });
}

/* ============================================================================
 * 🔒 DEEP FREEZE (ГЛУБОКАЯ ЗАМОРОЗКА)
 * ============================================================================
 */

/**
 * Deep freeze для полной иммутабельности объектов.
 * Рекурсивно замораживает все вложенные объекты и массивы.
 * Производительность:
 * - Для небольших объектов (< 100 ключей) - нет проблем
 * - Для больших объектов (тысячи ключей/вложенных объектов) - может быть медленно
 * - Используйте enableDeepFreeze: false для high-throughput систем с большими metadata
 * Защита от циклических ссылок:
 * - Использует WeakSet для отслеживания уже обработанных объектов
 * - Предотвращает бесконечную рекурсию при циклических ссылках
 * @param obj - Объект для заморозки
 * @param visited - WeakSet для отслеживания уже обработанных объектов (внутренний параметр)
 * @returns Замороженный объект (readonly на всех уровнях)
 */
export function deepFreeze<T>(obj: T, visited = new WeakSet<object>()): Readonly<T> {
  if (obj === null || typeof obj !== 'object') {
    return obj as Readonly<T>;
  }

  // Защита от циклических ссылок
  if (visited.has(obj as object)) {
    return obj as Readonly<T>;
  }

  visited.add(obj as object);
  Object.freeze(obj);

  if (Array.isArray(obj)) {
    obj.forEach((item) => deepFreeze(item, visited));
  } else {
    Object.values(obj).forEach((value) => {
      if (value !== null && typeof value === 'object') {
        deepFreeze(value, visited);
      }
    });
  }

  return obj as Readonly<T>;
}

/* ============================================================================
 * 🔒 METADATA VALIDATION & REDACTION
 * ============================================================================
 */

/** Обрезает длинные строки до максимальной длины. */
function truncateLongString(value: string, maxLength = MAX_METADATA_STRING_LENGTH): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...[TRUNCATED]` : value;
}

/** Обрабатывает одну запись metadata (ключ-значение). */
function processMetadataEntry(
  key: string,
  value: unknown,
  redactValue: string,
  enableValueScan: boolean,
  enableRegexDetection: boolean,
  visited: WeakSet<object>,
): unknown {
  // PII-детект на основе regex (не рекомендуется для продакшена из-за пропусков)
  if (enableRegexDetection && isPIIKey(key)) {
    return redactValue;
  }

  if (typeof value === 'string') {
    if (enableRegexDetection && enableValueScan && (isPIIValue(value) || isBase64Token(value))) {
      return redactValue;
    }
    return truncateLongString(value);
  }

  if (value !== null && typeof value === 'object') {
    // Защита от циклических ссылок
    if (visited.has(value)) {
      return '[Circular Reference]';
    }
    // Рекурсивная обработка вложенных объектов
    return deepValidateAndRedactPIIInternal(
      value,
      redactValue,
      enableValueScan,
      enableRegexDetection,
      visited,
    );
  }

  return value;
}

/**
 * Глубокая валидация и скрытие PII для metadata.
 * Рекурсивно проверяет и скрывает чувствительные данные.
 * ВАЖНО: PII-детект на основе регулярных выражений даёт пропуски!
 * Для высоких требований к безопасности рекомендуется:
 * - Использовать allow-list схему через типизированные контракты metadata
 * - Передавать кастомный sanitizeMetadata в конфиге
 * - Отключить enableRegexPIIDetection в продакшене
 * @param metadata - Метаданные для валидации
 * @param redactValue - Значение для замены PII (по умолчанию REDACTED)
 * @param enableValueScan - Включить сканирование значений на PII (по умолчанию false)
 * @param enableRegexDetection - Включить regex-детект (по умолчанию true, но не рекомендуется для продакшена)
 * @returns Валидированные и очищенные метаданные
 */
function deepValidateAndRedactPIIInternal<T>(
  metadata: T,
  redactValue: string,
  enableValueScan: boolean,
  enableRegexDetection: boolean,
  visited: WeakSet<object>,
): Readonly<T> {
  if (metadata === null || metadata === undefined) {
    return metadata as Readonly<T>;
  }

  if (
    typeof metadata === 'string' || typeof metadata === 'number' || typeof metadata === 'boolean'
  ) {
    return metadata as Readonly<T>;
  }

  // Защита от циклических ссылок
  if (typeof metadata === 'object') {
    if (visited.has(metadata)) {
      return '[Circular Reference]' as unknown as Readonly<T>;
    }
    visited.add(metadata);
  }

  if (Array.isArray(metadata)) {
    return metadata.map((item) =>
      deepValidateAndRedactPIIInternal(
        item,
        redactValue,
        enableValueScan,
        enableRegexDetection,
        visited,
      )
    ) as unknown as Readonly<T>;
  }

  if (typeof metadata === 'object') {
    const sanitized = Object.fromEntries(
      Object.entries(metadata as Record<string, unknown>).map(([key, value]) => [
        key,
        processMetadataEntry(
          key,
          value,
          redactValue,
          enableValueScan,
          enableRegexDetection,
          visited,
        ),
      ]),
    );

    // НЕ вызываем deepFreeze здесь - это будет сделано в applySanitization
    return sanitized as unknown as Readonly<T>;
  }

  return metadata as Readonly<T>;
}

/**
 * Deep validation и PII redaction для metadata.
 * Важно: `visited` намеренно скрыт, чтобы не допустить переиспользование состояния между вызовами.
 * Это уменьшает риск неочевидного поведения и помогает сохранять детерминированность.
 */
export function deepValidateAndRedactPII<T>(
  metadata: T,
  redactValue = REDACTED,
  enableValueScan = false,
  enableRegexDetection = true,
): Readonly<T> {
  return deepValidateAndRedactPIIInternal(
    metadata,
    redactValue,
    enableValueScan,
    enableRegexDetection,
    new WeakSet<object>(),
  );
}

/* ============================================================================
 * 🔒 ПРОСЛОЙКА ДЛЯ СКРЫТИЯ PII
 * ============================================================================
 */

/**
 * Middleware для скрытия PII на уровне core.
 * Гарантирует, что ни одно событие не попадет с чувствительными данными до отправки.
 * @param event - Событие для проверки
 * @param enableDeepScan - Включить глубокую рекурсивную проверку (по умолчанию false)
 * @returns Событие с очищенными метаданными (или без metadata если содержит PII)
 */
export function applyPIIRedactionMiddleware<TMetadata extends TelemetryMetadata>(
  event: TelemetryEvent<TMetadata>,
  enableDeepScan = false,
): TelemetryEvent<TMetadata> {
  if (!event.metadata) {
    return event;
  }

  // Security policy:
  // - fast path (enableDeepScan=false): detect → drop metadata
  // - deep path (enableDeepScan=true): sanitize → redact (не удаляем metadata целиком)
  if (enableDeepScan) {
    const sanitizedMetadata = deepValidateAndRedactPII(
      event.metadata,
      REDACTED,
      true, // enableValueScan (дороже, но это deep path)
      true, // enableRegexDetection (совместимость)
    );
    return {
      ...event,
      metadata: sanitizedMetadata as TMetadata,
    };
  }

  // Fast path: дешёвый детект без глубокого обхода
  if (containsPII(event.metadata, false)) {
    // Удаляем metadata из события для безопасности (переменная нужна только для деструктуризации)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- removedMetadata нужен только для деструктуризации
    const { metadata: removedMetadata, ...eventWithoutMetadata } = event;
    return eventWithoutMetadata as TelemetryEvent<TMetadata>;
  }

  return event;
}
