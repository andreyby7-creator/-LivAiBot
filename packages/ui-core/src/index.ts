/**
 * @file @livai/ui-core — атомарные UI компоненты (примитивы).
 *
 * Принцип:
 * - только UI-примитивы (без бизнес-логики и без контрактов API)
 * - без тяжёлых инфраструктурных зависимостей (db/sql/ai и т.п.)
 */

export * from './primitives/button.js';
export * from './primitives/input.js';
export * from './primitives/form-field.js';
