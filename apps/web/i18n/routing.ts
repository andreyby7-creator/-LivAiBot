/**
 * @file i18n routing настройки для next-intl (App Router).
 *
 * Локали должны соответствовать файлам переводов в messages/
 * @example en.json, ru.json
 *
 * Для добавления новой локали:
 * 1. Добавить в i18nConfig.locales
 * 2. Создать messages/[locale].json файл
 * 3. Обновить next-intl middleware если нужно
 */

/**
 * Конфигурация интернационализации
 * Синхронизировать с i18n.config.json при изменениях
 */
export const i18nConfig = {
  locales: ['en', 'ru'] as const,
  defaultLocale: 'en' as const,
};

/**
 * Доступные локали приложения
 */
export const locales = i18nConfig.locales;

/**
 * Тип локали для type safety
 */
export type Locale = (typeof locales)[number];

/**
 * Локаль по умолчанию
 */
export const defaultLocale: Locale = i18nConfig.defaultLocale;
