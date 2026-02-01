# Детальный анализ зависимостей App UI wrappers

## button.tsx

**Текущие deps**: feature-flags, i18n, telemetry
**Анализ**: ✅ Правильно - кнопки часто имеют локализованный текст
**Рекомендации**: Без изменений

## input.tsx

**Текущие deps**: feature-flags, i18n, telemetry
**Анализ**: ✅ Правильно - input может иметь placeholder'ы и labels на разных языках
**Рекомендации**: Без изменений

## textarea.tsx

**Текущие deps**: feature-flags, telemetry
**Анализ**: ✅ Правильно - базовый компонент без специальных потребностей
**Рекомендации**: Без изменений

## select.tsx

**Текущие deps**: feature-flags, telemetry
**Анализ**: ✅ Правильно - базовый компонент
**Рекомендации**: Без изменений

## checkbox.tsx

**Текущие deps**: feature-flags, telemetry
**Анализ**: ✅ Правильно - базовый form control
**Рекомендации**: Без изменений

## radio.tsx

**Текущие deps**: feature-flags, telemetry
**Анализ**: ✅ Правильно - базовый form control
**Рекомендации**: Без изменений

## toggle.tsx

**Текущие deps**: feature-flags, telemetry
**Анализ**: ✅ Правильно - базовый control
**Рекомендации**: Без изменений

## icon.tsx

**Текущие deps**: feature-flags, telemetry
**Анализ**: ✅ Правильно - чистый UI компонент
**Рекомендации**: Без изменений

## avatar.tsx

**Текущие deps**: feature-flags, telemetry
**Анализ**: ✅ Правильно - отображение изображения пользователя
**Рекомендации**: Без изменений

## badge.tsx

**Текущие deps**: feature-flags, telemetry
**Анализ**: ✅ Правильно - декоративный элемент
**Рекомендации**: Без изменений

## tooltip.tsx

**Текущие deps**: feature-flags, telemetry
**Анализ**: ✅ Правильно - всплывающая подсказка
**Рекомендации**: Без изменений

## divider.tsx

**Текущие deps**: feature-flags, telemetry
**Анализ**: ✅ Правильно - визуальный разделитель
**Рекомендации**: Без изменений

## card.tsx

**Текущие deps**: feature-flags, telemetry
**Анализ**: ✅ Правильно - контейнер контента
**Рекомендации**: Без изменений

## dialog.tsx

**Текущие deps**: feature-flags, telemetry
**Анализ**: ✅ Правильно - модальное окно
**Рекомендации**: Без изменений

## form.tsx

**Текущие deps**: feature-flags, telemetry, validation
**Анализ**: ✅ Правильно - UI-boundary с клиентской валидацией через централизованную систему
**Рекомендации**: Без изменений

## loading-spinner.tsx

**Текущие deps**: feature-flags, telemetry
**Анализ**: ✅ Правильно - индикатор загрузки
**Рекомендации**: Без изменений

## dropdown.tsx

**Текущие deps**: feature-flags, telemetry
**Анализ**: ✅ Правильно - выпадающий список
**Рекомендации**: Без изменений

## context-menu.tsx

**Текущие deps**: feature-flags, telemetry
**Анализ**: ✅ Правильно - контекстное меню
**Рекомендации**: Без изменений

## status-indicator.tsx

**Текущие deps**: feature-flags, telemetry
**Анализ**: ✅ Правильно - индикатор статуса
**Рекомендации**: Без изменений

## toast.tsx

**Текущие deps**: feature-flags, telemetry, types/errors
**Анализ**: ✅ Правильно - toast с типизированной обработкой ошибок
**Рекомендации**: Без изменений

## skeleton.tsx

**Текущие deps**: feature-flags, telemetry
**Анализ**: ✅ Правильно - placeholder контента
**Рекомендации**: Без изменений

## skeleton-group.tsx

**Текущие deps**: feature-flags, telemetry
**Анализ**: ✅ Правильно - группа placeholders
**Рекомендации**: Без изменений

## modal.tsx

**Текущие deps**: feature-flags, telemetry (+ ui-core/types)
**Анализ**: ✅ Правильно - уже зависит от ui-core типов
**Рекомендации**: Без изменений

## breadcrumbs.tsx

**Текущие deps**: feature-flags, telemetry
**Анализ**: ✅ Правильно - навигационная цепочка
**Рекомендации**: Без изменений

## tabs.tsx

**Текущие deps**: feature-flags, telemetry
**Анализ**: ✅ Правильно - организация контента
**Рекомендации**: Без изменений

## accordion.tsx

**Текущие deps**: feature-flags, telemetry
**Анализ**: ✅ Правильно - сворачиваемый контент
**Рекомендации**: Без изменений

## date-picker.tsx

**Текущие deps**: feature-flags, telemetry
**Анализ**: ⚠️ Неполные зависимости - даты часто интернационализируются
**Рекомендации**: Добавить `lib/i18n.ts` для локализации дат

## file-uploader.tsx

**Текущие deps**: feature-flags, telemetry, validation, types/api
**Анализ**: ✅ Правильно - file-uploader с централизованной валидацией
**Рекомендации**: Без изменений

## sidebar.tsx

**Текущие deps**: feature-flags, telemetry
**Анализ**: ✅ Правильно - навигационная панель
**Рекомендации**: Без изменений

## search-bar.tsx

**Текущие deps**: feature-flags, telemetry
**Анализ**: ✅ Правильно - компонент поиска
**Рекомендации**: Без изменений

## confirm-dialog.tsx

**Текущие deps**: feature-flags, telemetry
**Анализ**: ✅ Правильно - диалог подтверждения
**Рекомендации**: Без изменений

## error-boundary.tsx

**Текущие deps**: feature-flags, telemetry
**Анализ**: ⚠️ Неполные зависимости - boundary обрабатывает ошибки
**Рекомендации**: Добавить `lib/error-mapping.ts` для обработки ошибок и `types/errors.ts` для типизации

## user-profile-display.tsx

**Текущие deps**: feature-flags, telemetry
**Анализ**: ⚠️ Неполные зависимости - профиль пользователя может требовать авторизации
**Рекомендации**: Добавить `lib/auth-guard.ts` для проверки доступа и `types/common.ts` для типов пользователя

## navigation-menu-item.tsx

**Текущие deps**: feature-flags, telemetry
**Анализ**: ⚠️ Неполные зависимости - навигация может иметь права доступа
**Рекомендации**: Добавить `lib/route-permissions.ts` для проверки прав доступа

## language-selector.tsx

**Текущие deps**: feature-flags, telemetry, i18n
**Анализ**: ✅ Корректные зависимости - селектор языка использует i18n для переводов названий языков
**Рекомендации**: Зависимости соответствуют архитектуре

## support-button.tsx

**Текущие deps**: feature-flags, telemetry
**Анализ**: ✅ Правильно - кнопка поддержки с analytics
**Рекомендации**: Без изменений

## Резюме анализа

### Компоненты без изменений (33/36):

button, input, textarea, select, checkbox, radio, toggle, icon, avatar, badge, tooltip, divider, card, dialog, loading-spinner, dropdown, context-menu, status-indicator, skeleton, skeleton-group, modal, breadcrumbs, tabs, accordion, sidebar, search-bar, confirm-dialog, support-button, form, toast, file-uploader, date-picker, language-selector

### Компоненты требующие изменений (3/36):

1. **error-boundary.tsx** → добавить `lib/error-mapping.ts`, `types/errors.ts`
2. **user-profile-display.tsx** → добавить `lib/auth-guard.ts`, `types/common.ts`
3. **navigation-menu-item.tsx** → добавить `lib/route-permissions.ts`

## Архитектурные выводы:

- Большинство компонентов правильно спроектированы
- 4 компонента требуют дополнительных зависимостей для полной функциональности
- Добавление зависимостей улучшит type safety, консистентность API и предотвратит дублирование логики
- Архитектура останется чистой и модульной
