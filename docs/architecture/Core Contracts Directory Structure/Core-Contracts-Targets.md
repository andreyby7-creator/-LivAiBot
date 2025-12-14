# Core Contracts Targets

## Обзор

Targets - это специализированные точки входа для разных runtime окружений. Они позволяют адаптировать core-contracts под специфические требования платформ, сохраняя при этом функциональную чистоту и типобезопасность.

## Структура директорий

```
core-contracts/
├── src/
│   └── targets/                    # 🔹 Target-specific entrypoints
│                                   #    (TypeScript + FP-friendly)
│
├── index.ts                        # 🎯 Центральный экспорт всех targets
│
├── browser.ts                      # 🎯 Точка входа для браузерного окружения
│                                   #    Специфичные импорты и адаптации
│
├── mobile.ts                       # 🎯 Точка входа для мобильных платформ
│                                   #    (React Native / Expo), адаптации runtime
│
├── node.ts                         # 🎯 Точка входа для Node.js окружения
│                                   #    fs, path, process и др.
│
├── server.ts                       # 🎯 Точка входа для серверного runtime
│                                   #    (API / SSR), серверные адаптации
│
├── shared.ts                       # 🎯 Общие точки входа для всех платформ
│                                   #    (runtime-agnostic)
│
└── README.md                       # 📘 Документация по targets и runtime адаптациям
```

## Назначение Targets

### Browser Target (`browser.ts`)
- **Runtime:** Веб-браузеры (Chrome, Firefox, Safari, Edge)
- **Особенности:**
  - DOM API адаптации
  - Web Storage, IndexedDB
  - Service Workers
  - Web APIs (Fetch, WebSockets)

### Mobile Target (`mobile.ts`)
- **Runtime:** React Native, Expo
- **Особенности:**
  - React Native APIs
  - AsyncStorage
  - Device capabilities
  - Platform-specific код

### Node Target (`node.ts`)
- **Runtime:** Node.js серверы
- **Особенности:**
  - File System operations
  - Process management
  - Network operations
  - Server-specific APIs

### Server Target (`server.ts`)
- **Runtime:** SSR, API servers, microservices
- **Особенности:**
  - HTTP/HTTPS handling
  - Database connections
  - Caching layers
  - Server middleware

### Shared Target (`shared.ts`)
- **Runtime:** Универсальный (работает везде)
- **Особенности:**
  - Platform-agnostic код
  - Pure functions only
  - No side effects
  - Maximum portability

## Принципы работы

### Runtime Detection
```typescript
// Автоматическое определение runtime
const isBrowser = typeof window !== 'undefined';
const isNode = typeof process !== 'undefined';
const isMobile = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
```

### Conditional Exports
```typescript
// Условные экспорты на основе runtime
export const storage = isBrowser
  ? browserStorage
  : isMobile
  ? mobileStorage
  : nodeStorage;
```

### Type Guards
```typescript
// Runtime-specific типы
export type BrowserConfig = { /* browser-specific */ };
export type NodeConfig = { /* node-specific */ };
export type MobileConfig = { /* mobile-specific */ };
```

## Использование

### Импорт по платформе
```typescript
// Для браузера
import { storage, config } from '@livai/core-contracts/browser';

// Для Node.js
import { fs, network } from '@livai/core-contracts/node';

// Для мобильных
import { device, storage } from '@livai/core-contracts/mobile';

// Универсальный
import { utils, types } from '@livai/core-contracts/shared';
```

### Автоматический выбор
```typescript
// Автоматический выбор на основе runtime
import { createApp } from '@livai/core-contracts';
// createApp автоматически адаптируется под текущий runtime
```

## Архитектурные преимущества

### Platform Agnostic Core
- **99% кода** работает на всех платформах
- **Target-specific** только адаптеры (1%)
- **Type safety** на всех платформах

### Tree Shaking
- **Unused targets** исключаются при сборке
- **Minimal bundle size** для каждой платформы
- **Optimal performance** для каждого runtime

### Developer Experience
- **IntelliSense** понимает платформу
- **Type checking** для каждого target
- **Runtime guarantees** на этапе компиляции

## Сборка и оптимизация

### Target-specific Bundles
```bash
# Сборка только для браузера
pnpm build:browser

# Сборка только для Node.js
pnpm build:node

# Сборка для всех платформ
pnpm build:all
```

### Conditional Compilation
```typescript
// Код исключается на этапе сборки
if (process.env.TARGET === 'browser') {
  // Только для браузера
}

if (process.env.TARGET === 'node') {
  // Только для Node.js
}
```

## Лучшие практики

### Target Organization
1. **Shared first** - пиши универсальный код
2. **Target-specific** - добавляй адаптации по необходимости
3. **Type safety** - используй discriminated unions для разных targets

### Performance Considerations
1. **Lazy loading** - загружай target-specific код по требованию
2. **Tree shaking** - обеспечивай чистые exports
3. **Bundle analysis** - мониторь размер бандлов

### Testing Strategy
1. **Shared tests** - для универсального кода
2. **Target-specific tests** - для каждой платформы
3. **Integration tests** - для взаимодействия targets

---

*Targets обеспечивают seamless experience разработки на всех платформах с максимальной типобезопасностью и производительностью.*
