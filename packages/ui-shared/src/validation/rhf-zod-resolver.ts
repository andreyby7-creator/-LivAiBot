/**
 * @file Zod → React Hook Form resolver (Zod v4 friendly).
 *
 * Причина существования:
 * - типы `@hookform/resolvers/zod` часто отстают от Zod v4
 * - нам нужен стабильный мост между Zod и RHF в рамках Фазы 2
 */

import type { FieldErrors, FieldValues, Resolver } from 'react-hook-form';
import type { z, ZodError } from 'zod';

import { ValidationKeys } from './zod.js';

// Словарь origin+code → key для расширяемости (Zod v4 использует `origin`)
const errorKeyMap: Record<string, Record<string, string>> = {
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
// 'custom' исключен, так как для custom валидаций лучше использовать issue.message
const extraCodeMap: Record<string, string> = {
  invalid_enum: ValidationKeys.invalidEnum,
  invalid_union: ValidationKeys.invalidUnion,
  // Zod v4 для `z.literal()` обычно отдаёт `invalid_value`
  invalid_value: ValidationKeys.invalidLiteral,
  unrecognized_keys: ValidationKeys.unrecognizedKeys,
};

function issueToKey(issue: z.core.$ZodIssueBase): string {
  // Расширяем тип ZodIssueBase дополнительными полями для IDE поддержки
  const i = issue as z.core.$ZodIssueBase & {
    received?: unknown;
    type?: string;
    origin?: string;
    expected?: unknown;
    values?: readonly unknown[];
  };

  // Минимальный mapping для UI. Расширяем по мере появления новых требований.
  // Важно: ключи должны существовать в messages (next-intl).

  // Required field (null/undefined values)
  // В Zod v4 поле `received` может отсутствовать, поэтому используем и текст сообщения.
  const isRequired = i.code === 'invalid_type'
    && (i.received == null
      || (typeof i.message === 'string'
        && (i.message.includes('received undefined') || i.message.includes('received null'))));
  if (isRequired) {
    return ValidationKeys.required;
  }

  // Type-specific validations using the map (только когда origin/type надежно установлен)
  const origin = i.origin ?? i.type;
  if (typeof origin === 'string' && i.code !== undefined) {
    const typeMap = errorKeyMap[origin];
    const key = typeMap?.[i.code];
    if (key !== undefined) {
      return key;
    }
  }

  // Дополнительные Zod коды через extraCodeMap
  if (i.code !== undefined) {
    const extraKey = extraCodeMap[i.code];
    if (extraKey !== undefined) {
      return extraKey;
    }
  }

  // Для случаев без установленного type возвращаем issue.message
  // Это обеспечивает совместимость с RHF и позволяет кастомным валидациям работать
  return issue.message;
}

function setNestedError<T extends FieldValues>(
  errors: FieldErrors<T>,
  path: readonly PropertyKey[],
  value: FieldErrors<T>[string],
): FieldErrors<T> {
  if (path.length === 0) {
    // Корневые ошибки (без пути) кладем в специальное поле 'root'
    // Это редкий кейс для глобальных ошибок схемы, не связанных с конкретным полем
    return {
      ...errors,
      root: value,
    } as FieldErrors<T>;
  }

  // Рекурсивно строим новую структуру объектов
  function buildNestedObject(
    currentPath: readonly PropertyKey[],
    currentErrors: Record<string, unknown>,
  ): Record<string, unknown> {
    if (currentPath.length === 0) {
      return value as unknown as Record<string, unknown>;
    }

    const [firstKey, ...restPath] = currentPath;
    const key = String(firstKey);
    const existingValue = currentErrors[key];

    let nestedValue: Record<string, unknown>;
    if (
      typeof existingValue === 'object' && existingValue !== null && !Array.isArray(existingValue)
    ) {
      // Рекурсивно строим вложенный объект
      nestedValue = buildNestedObject(restPath, existingValue as Record<string, unknown>);
    } else {
      // Создаем новый объект для вложенного пути
      nestedValue = buildNestedObject(restPath, {});
    }

    return {
      ...currentErrors,
      [key]: nestedValue,
    };
  }

  return buildNestedObject(path, errors as Record<string, unknown>) as FieldErrors<T>;
}

export function zodResolver<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
): Resolver<z.infer<TSchema> & FieldValues> {
  return (values: unknown) => {
    const parsed = schema.safeParse(values);
    if (parsed.success) {
      return { values: parsed.data as z.infer<TSchema> & FieldValues, errors: {} };
    }

    let errors: FieldErrors<z.infer<TSchema> & FieldValues> = {};
    const err: ZodError = parsed.error;

    for (const issue of err.issues) {
      const key = issueToKey(issue);
      errors = setNestedError(errors, issue.path, { type: issue.code, message: key });
    }

    // Возвращаем пустой объект values при ошибках - стандарт RHF
    // Это не ломает downstream логику, так как RHF работает с errors объектом
    return { values: {}, errors };
  };
}
