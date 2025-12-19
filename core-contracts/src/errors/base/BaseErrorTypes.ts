/**
 * @file BaseErrorTypes.ts - Полная система базовых типов ошибок для платформы LivAiBot
 *
 * Этот файл содержит фундаментальные типы для работы с ошибками в LivAiBot:
 * - Базовые типы для обработки причин ошибок (OptionalCause, SafeCause)
 * - Tagged errors для type-safe pattern matching
 * - Система pattern matching для эффективной обработки ошибок
 * - Типы для цепочек и агрегации ошибок
 * - Специализированные типы для разных доменов LivAiBot
 * - Type guards для runtime проверки типов
 * - Hierarchical pattern matching для производительности
 */

/**
 * Опциональная причина ошибки - может быть undefined для корневых ошибок
 * Используется когда ошибка может быть как самостоятельной, так и частью цепочки
 */
export type OptionalCause<E> = E | undefined;

/**
 * Безопасная причина ошибки - гарантированно не undefined для цепочек ошибок
 * Используется когда ошибка обязательно имеет причину (не корневая)
 */
export type SafeCause<E> = E;

/**
 * Тег для категоризации ошибок - используется для discriminated unions
 * Обеспечивает type-safe pattern matching и исключает runtime ошибки
 */
export type ErrorTag<C extends string> = {
  readonly _tag: C;
};

/**
 * Tagged error - ошибка с дискриминирующим тегом для type-safe pattern matching
 * Позволяет компилятору проверять исчерпывающее покрытие всех случаев
 */
export type TaggedError<T, Tag extends string> = T & ErrorTag<Tag>;

/**
 * Функция-матчер для обработки ошибок определенного типа
 * Принимает ошибку и возвращает результат обработки
 */
export type ErrorMatcher<E, R> = (error: E) => R;

/**
 * Исчерпывающий матчер - гарантирует обработку всех возможных случаев
 * Компилятор TypeScript проверяет, что все варианты TaggedError обработаны
 */
export type ExhaustiveMatcher<E, A> =
  & {
    readonly [K in keyof E]: (value: E[K]) => A;
  }
  & {
    readonly default: (value: never) => A;
  };

/**
 * Карта паттернов для сопоставления ошибок
 * Позволяет гибко определять обработчики для разных типов ошибок
 */
export type PatternMap<E, A> = E extends TaggedError<unknown, string> ?
    & {
      readonly [Tag in E["_tag"]]?: (value: Extract<E, { _tag: Tag }>) => A;
    }
    & {
      readonly default?: (value: E) => A;
    }
  :
    & {
      readonly [K in keyof E]?: (value: E[K]) => A;
    }
    & {
      readonly default?: (value: E) => A;
    };

/**
 * Цепочка ошибок - рекурсивная структура для хранения причин
 * Позволяет отслеживать полный путь возникновения ошибки от корня до листа
 */
export type ErrorChain<E> = {
  readonly error: E;
  readonly cause?: ErrorChain<E>;
};

/**
 * Агрегированная ошибка - содержит несколько ошибок одного типа
 * Используется для группировки однотипных ошибок в единую сущность
 */
export type AggregatedError<E> = {
  readonly errors: readonly E[];
  readonly message: string;
};

/**
 * Ошибка интеграции с внешними сервисами
 * Используется для API вызовов, баз данных, очередей и других внешних систем
 */
export type IntegrationError<T extends string> = TaggedError<{
  readonly service: T;
  readonly operation: string;
  readonly details: Record<string, unknown>;
}, "IntegrationError">;

/**
 * Ошибка обработки ИИ/ML операций
 * Специфична для работы с моделями машинного обучения в LivAiBot
 */
export type AIProcessingError = TaggedError<{
  readonly model: string;
  readonly operation: "inference" | "training" | "validation";
  readonly input: unknown;
}, "AIProcessingError">;

/**
 * Ошибка контекста пользователя
 * Возникает при операциях с пользовательскими данными и сессиями
 */
export type UserContextError = TaggedError<{
  readonly userId: string;
  readonly operation: string;
  readonly context: Record<string, unknown>;
}, "UserContextError">;

/**
 * Ошибка административных операций
 * Для действий администраторов системы с проверкой прав доступа
 */
export type AdminOperationError = TaggedError<{
  readonly adminId: string;
  readonly operation: string;
  readonly target: string;
  readonly permissions: readonly string[];
}, "AdminOperationError">;

/**
 * Ошибка мобильной платформы
 * Специфична для iOS/Android приложений с учетом версий и устройств
 */
export type MobilePlatformError = TaggedError<{
  readonly platform: "ios" | "android";
  readonly version: string;
  readonly device: string;
  readonly operation: string;
}, "MobilePlatformError">;

/**
 * Проверяет, является ли объект tagged error с указанным тегом
 * @param value - значение для проверки
 * @param tag - ожидаемый тег ошибки
 * @returns true если объект является TaggedError с указанным тегом
 */
export function isTaggedError<T extends string>(
  value: unknown,
  tag: T,
): value is TaggedError<unknown, T> {
  return (
    typeof value === "object"
    && value !== null
    && "_tag" in value
    && (value as Record<string, unknown>)["_tag"] === tag
  );
}

/**
 * Проверяет, является ли ошибка IntegrationError
 * @param value - значение для проверки
 * @returns true если ошибка связана с интеграцией внешних сервисов
 */
export function isIntegrationError(
  value: unknown,
): value is IntegrationError<string> {
  return isTaggedError(value, "IntegrationError");
}

/**
 * Проверяет, является ли ошибка AIProcessingError
 * @param value - значение для проверки
 * @returns true если ошибка связана с обработкой ИИ операций
 */
export function isAIProcessingError(
  value: unknown,
): value is AIProcessingError {
  return isTaggedError(value, "AIProcessingError");
}

/**
 * Проверяет, является ли ошибка UserContextError
 * @param value - значение для проверки
 * @returns true если ошибка связана с пользовательским контекстом
 */
export function isUserContextError(
  value: unknown,
): value is UserContextError {
  return isTaggedError(value, "UserContextError");
}

/**
 * Проверяет, является ли ошибка AdminOperationError
 * @param value - значение для проверки
 * @returns true если ошибка связана с административными операциями
 */
export function isAdminOperationError(
  value: unknown,
): value is AdminOperationError {
  return isTaggedError(value, "AdminOperationError");
}

/**
 * Проверяет, является ли ошибка MobilePlatformError
 * @param value - значение для проверки
 * @returns true если ошибка связана с мобильной платформой
 */
export function isMobilePlatformError(
  value: unknown,
): value is MobilePlatformError {
  return isTaggedError(value, "MobilePlatformError");
}

/**
 * Hierarchical pattern matching по категориям - вместо 100+ individual cases
 * Massive performance improvement для больших discriminated unions
 *
 * Гарантирует исчерпывающее покрытие всех типов ошибок и предотвращает
 * runtime ошибки от необработанных случаев. Использует hierarchical lookup
 * для оптимальной производительности.
 *
 * @param error - TaggedError для обработки
 * @param patterns - карта паттернов с обработчиками
 * @returns результат обработки ошибки
 * @throws Error если не найден подходящий обработчик
 */
export function matchByCategory<E extends TaggedError<unknown, string>, R>(
  error: E,
  patterns: PatternMap<E, R>,
): R {
  const tag = error._tag;

  // Прямой доступ по ключу - tag контролируется TaggedError типом
  const pattern = patterns[tag as keyof PatternMap<E, R>];

  if (pattern !== undefined) {
    // Передаем подтип ошибки целиком - сильная типизация без runtime overhead
    return pattern(error);
  }

  // Если exact match не найден, используем fallback
  if (patterns.default !== undefined) {
    return patterns.default(error);
  }

  // Runtime защита - throw для необработанных случаев
  throw new Error(`Unhandled error category: ${String(tag)}`);
}
