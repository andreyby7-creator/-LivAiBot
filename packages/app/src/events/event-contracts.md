# Контракты Событий Приложения

## Обзор

Этот документ описывает контракты всех событий приложения для потребителей (consumers).
Используется для интеграции между микросервисами.

## Структура События

```typescript
interface AppEvent {
  type: AppEventType;
  version: '1.0.0'; // Версия контракта (breaking changes)
  eventVersion: number; // Версия схемы payload
  timestamp: string; // ISO 8601
  payload: EventPayload; // Типизированный payload
  meta?: {
    correlationId?: string; // Для tracing
    source?: string; // Источник события
    initiator?: EventInitiator; // Инициатор
  };
}
```

## Типы Событий

### AuthLogout

**Тип:** `auth.logout`
**Версия схемы:** 1
**Описание:** Пользователь вышел из системы

**Payload:**

```typescript
{
  payloadVersion: 1,
  userId: string,
  roles: UserRoles[],
  reason: 'manual' | 'security' | 'system',
  source?: string
}
```

**Примеры использования:**

- Пользователь нажал "Выйти"
- Система принудительно вышла пользователя по безопасности
- Автоматический выход по истечению сессии

### AuthExpired

**Тип:** `auth.expired`
**Версия схемы:** 1
**Описание:** Истек токен авторизации

**Payload:**

```typescript
{
  payloadVersion: 1,
  userId: string,
  reason: 'token_expired' | 'revoked' | 'invalid',
  source?: string
}
```

**Примеры использования:**

- JWT токен истек
- Токен был отозван администратором
- Токен имеет неправильную подпись

### BillingChanged

**Тип:** `billing.changed`
**Версия схемы:** 1
**Описание:** Изменился тариф или биллинг пользователя

**Payload:**

```typescript
{
  payloadVersion: 1,
  userId: string,
  plan: string,
  previousPlan?: string,
  reason: 'upgrade' | 'downgrade' | 'renewal' | 'cancellation',
  source?: string
}
```

**Примеры использования:**

- Пользователь сменил тарифный план
- Автоматическое продление подписки
- Отмена подписки

## Инициаторы Событий

- `'UI'` - Пользовательский интерфейс
- `'Worker'` - Фоновый воркер
- `'Cron'` - Запланированная задача
- `'api'` - Внешний API вызов
- `string` - Произвольный инициатор

## Версионирование

### Version (контракт события)

- `'1.0.0'` - Текущая версия
- Изменяется только при breaking changes в структуре события

### eventVersion (схема payload)

- Начинается с `1`
- Увеличивается при изменениях в payload схеме
- Позволяет consumer'ам обрабатывать разные версии

### payloadVersion (внутри payload)

- Начинается с `1`
- Увеличивается при изменениях в структуре конкретного payload
- Consumer проверяет совместимость по этому полю

## Обработка Ошибок

- Событие считается созданным успешно даже если push в очередь провалился
- Ошибки push логируются, но не прерывают бизнес-логику
- Consumer'ы должны быть готовы к дубликатам (at-least-once delivery)

## Consumer Guidelines

1. Всегда проверяйте `eventVersion` и `payloadVersion`
2. Используйте `correlationId` для tracing
3. Обрабатывайте неизвестные поля gracefully
4. Логируйте необработанные события
5. Реализуйте idempotency для идемпотентных операций
