/**
 * @file TEZ: Type Exemption Zone для LivAi
 *
 * ❌ не костыль
 * ❌ не помойка
 * ❌ не архив старых ошибок
 *
 * ✅ барьер дисциплины
 *
 * Любая новая запись = архитектурный инцидент, а не «ну давайте добавим».
 * Этот файл должен быть маленький, злой и честный.
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Type Exemption Zone (TEZ) - Минимальная конфигурация
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * ⚠️ СТРОГО МИНИМАЛЬНАЯ allow-list
 *
 * Исключения ТОЛЬКО для типов, которые:
 * - определены спецификацией (DOM / Web)
 * - мутабельны по контракту
 * - невозможно безопасно сделать readonly
 */

export const TYPE_EXEMPTIONS = {
  /**
   * DOM / Web Platform
   *
   * Мутабельны по спецификации.
   * Readonly нарушает контракт Web APIs.
   */
  web: [
    { from: 'lib', name: 'Event' },
    { from: 'lib', name: 'EventTarget' },
    { from: 'lib', name: 'Node' },
    { from: 'lib', name: 'Element' },
    { from: 'lib', name: 'HTMLElement' },
    { from: 'lib', name: 'KeyboardEvent' },
  ],

  /**
   * Fetch API
   *
   * Request / Response мутабельны по дизайну.
   * Init-объекты используются как конфигурация
   * и широко передаются как параметры функций.
   */
  fetch: [
    { from: 'lib', name: 'Request' },
    { from: 'lib', name: 'Response' },
    'RequestInit',
    { from: 'lib', name: 'ResponseInit' },
  ],
};

export const FLATTENED_TYPE_EXEMPTIONS = Object.values(TYPE_EXEMPTIONS).flat();

export const TEZ_STATS = {
  totalTypes: FLATTENED_TYPE_EXEMPTIONS.length,
  categories: Object.keys(TYPE_EXEMPTIONS),
};
