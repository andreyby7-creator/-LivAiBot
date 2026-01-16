/**
 * @file Интеграция Zod ошибок с UI (i18n ключи, маппинг).
 *
 * Принцип:
 * - Zod схемы возвращают `issue.message` (либо дефолтную строку, либо i18n ключ)
 * - UI решает, как переводить/показывать это сообщение
 */

import type { TFunction } from '../i18n/types.js';

/**
 * Константы для i18n ключей валидации (предотвращают опечатки).
 */
export const ValidationKeys = {
  // Общие
  required: 'validation.required',
  invalidType: 'validation.invalidType',
  invalidEnum: 'validation.invalidEnum',
  custom: 'validation.custom',
  invalidUnion: 'validation.invalidUnion',
  invalidLiteral: 'validation.invalidLiteral',
  unrecognizedKeys: 'validation.unrecognizedKeys',

  // String
  stringMin: 'validation.string.min',
  stringMax: 'validation.string.max',
  stringEmail: 'validation.string.email',
  stringUrl: 'validation.string.url',

  // Number
  numberMin: 'validation.number.min',
  numberMax: 'validation.number.max',

  // Array
  arrayMin: 'validation.array.min',
  arrayMax: 'validation.array.max',
} as const;

/**
 * Тип для Zod error map функций.
 *
 * @param issue - Объект ошибки Zod с полями code, path, message и др.
 * @param ctx - Контекст с defaultError (стандартное сообщение Zod, используется как fallback)
 * @returns Объект с i18n ключом или готовым сообщением
 */
export type ZodErrorMapLike = (
  issue: unknown,
  ctx: { defaultError: string; },
) => { message: string; };

/**
 * Универсальный перевод: если `t` задан — пробуем `t(message)` и fallback на исходный текст.
 */
export function translateZodMessage(message: string, t?: TFunction): string {
  if (!t) return message;
  return t(message) ?? message;
}

/**
 * Строит nested i18n ключ с путем поля.
 *
 * @param path - Путь к полю
 * @param key - Базовый ключ
 * @param options.nested - Включить nested логику
 * @param options.shouldNest - Предикат для проверки ключа
 *
 * @example
 * buildNestedKey(['user'], 'validation.required', { nested: true })
 * // → 'user.validation.required'
 */
export function buildNestedKey(
  path: (string | number)[],
  key: string,
  options: {
    nested?: boolean;
    shouldNest?: (key: string) => boolean;
  } = {},
): string {
  const shouldNest = options.shouldNest ?? ((k: string): boolean => k.startsWith('validation.'));
  if (options.nested === true && Array.isArray(path) && path.length > 0 && shouldNest(key)) {
    const pathStr = path.map((segment) => String(segment)).join('.');
    return pathStr ? `${pathStr}.${key}` : key;
  }
  return key;
}

/**
 * Создает errorMap с i18n ключами для Zod.
 * Поддерживает string/number/array валидации, required, invalidType, custom коды.
 *
 * @param options.nested - Автоматически добавлять путь поля к ключам
 * @returns Функция errorMap для ZodResolver
 *
 * @example
 * const errorMap = createZodI18nErrorMap();
 * const resolver = zodResolver(schema, { errorMap });
 */
export function createZodI18nErrorMap(options: { nested?: boolean; } = {}): ZodErrorMapLike {
  // Мапа для устранения повторов: type -> { code -> key }
  const typeCodeMap: Record<string, Record<string, string>> = {
    string: {
      too_small: ValidationKeys.stringMin,
      too_big: ValidationKeys.stringMax,
    },
    number: {
      too_small: ValidationKeys.numberMin,
      too_big: ValidationKeys.numberMax,
    },
    array: {
      too_small: ValidationKeys.arrayMin,
      too_big: ValidationKeys.arrayMax,
    },
  };

  // Мапа для дополнительных Zod кодов (без type-specific логики)
  const extraCodes: Record<string, string> = {
    invalid_enum: ValidationKeys.invalidEnum,
    custom: ValidationKeys.custom,
    invalid_union: ValidationKeys.invalidUnion,
    invalid_literal: ValidationKeys.invalidLiteral,
    unrecognized_keys: ValidationKeys.unrecognizedKeys,
  };

  return (issue: unknown, ctx: { defaultError: string; }) => {
    const i = issue as {
      code?: string;
      received?: unknown;
      expected?: unknown;
      type?: string;
      path?: (string | number)[];
      message?: string;
      minimum?: number;
      maximum?: number;
    };

    let message = ctx.defaultError; // Запасной вариант по умолчанию

    // Обрабатываем все коды ошибок
    if (i.code === 'invalid_type') {
      // Обязательное поле (неопределенное значение)
      if (i.received === 'undefined') {
        message = ValidationKeys.required;
      } else {
        // Другие недопустимые типы
        message = ValidationKeys.invalidType;
      }
    } // Тип-специфичные валидации через мапу
    else if (typeof i.type === 'string' && typeof i.code === 'string') {
      const typeMap = typeCodeMap[i.type];
      const key = typeMap?.[i.code];
      if (typeof key === 'string') {
        message = key;
      }
    } // Дополнительные коды Zod (запасной вариант ctx.defaultError если не найдено)
    else if (typeof i.code === 'string') {
      const extraKey = extraCodes[i.code];
      if (extraKey !== undefined) {
        message = extraKey;
      }
    }
    // message остается ctx.defaultError если нет совпадений

    // Добавляем префикс пути для nested форм если включено
    message = buildNestedKey(i.path ?? [], message, options);

    return { message };
  };
}
