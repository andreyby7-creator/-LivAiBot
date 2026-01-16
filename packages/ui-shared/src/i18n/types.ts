/**
 * @file Общие типы для i18n в UI слое.
 */

/**
 * Минимальный контракт для функции перевода.
 *
 * Принципы:
 * - не бросает исключений
 * - всегда возвращает строку или `undefined`
 * - UI обязан сам решать, что делать с отсутствующим переводом
 *
 * Адаптеры (next-intl, i18next и т.д.) должны приводиться к этой форме.
 *
 * @template K - Тип ключей перевода (по умолчанию string для максимальной гибкости)
 *
 * @example
 * ```typescript
 * // Базовое использование (string ключи)
 * const t: TFunction = (key) => translations[key] || key;
 *
 * // Строго типизированные ключи
 * type AppKeys = 'form.submit' | 'form.cancel' | 'nav.home';
 * const t: TFunction<AppKeys> = (key) => {
 *   switch (key) {
 *     case 'form.submit': return 'Отправить';
 *     case 'form.cancel': return 'Отмена';
 *     case 'nav.home': return 'Главная';
 *     default: return key;
 *   }
 * };
 * ```
 */
export type TFunction<K extends string = string> = (key: K) => string | undefined;
