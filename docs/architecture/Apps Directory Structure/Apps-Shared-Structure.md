## 📁 СТРУКТУРА APPS/SHARED/

apps/shared-ui/ # 🔹 Общие ресурсы фронтенда для всех apps (TypeScript + FP + Effect) ├── dto/ # 🔹
Общие API DTO (frontend ↔ API) │ ├── UserApiDTO.ts # 🔹 DTO для пользователей (TypeScript + FP) │
├── SubscriptionApiDTO.ts # 🔹 DTO для подписок (TypeScript + FP) │ ├── BillingApiDTO.ts # 🔹 DTO
для платежей (TypeScript + FP) │ └── BotApiDTO.ts # 🔹 DTO для AI-ботов (TypeScript + FP) ├──
mappers/ # 🔹 Общие мапперы API DTO ↔ frontend models │ ├── UserMapper.ts # 🔹 Маппинг пользователей
(TypeScript + FP) │ ├── SubscriptionMapper.ts # 🔹 Маппинг подписок (TypeScript + FP) │ ├──
BillingMapper.ts # 🔹 Маппинг платежей (TypeScript + FP) │ └── BotMapper.ts # 🔹 Маппинг AI-ботов
(TypeScript + FP) ├── ui/ # 🔹 Общие UI компоненты (atoms/molecules/organisms) │ ├── atoms/ # 🔹
Базовые компоненты (Button, Input) (TypeScript + React + FP) │ ├── molecules/ # 🔹 Составные
компоненты (Table, Form, Modal) (TypeScript + React + FP) │ └── organisms/ # 🔹 Комплексные UI блоки
(UserTable, BillingCard, Charts, Analytics) (TypeScript + React + FP) │ ├── charts/ # 🔹 Chart
widgets для больших dashboards (billing, ai-bots) │ │ ├── RevenueChart.tsx # 🔹 График доходов
(TypeScript + React + Chart.js/Recharts) │ │ ├── TokenUsageChart.tsx # 🔹 График использования
токенов (TypeScript + React + Chart.js/Recharts) │ │ ├── UserGrowthChart.tsx # 🔹 График роста
пользователей (TypeScript + React + Chart.js/Recharts) │ │ └── PerformanceChart.tsx # 🔹 График
производительности AI (TypeScript + React + Chart.js/Recharts) │ └── analytics/ # 🔹 Analytics
widgets │ ├── MetricCard.tsx # 🔹 Карточка метрики (TypeScript + React + FP) │ ├──
TrendIndicator.tsx # 🔹 Индикатор тренда (TypeScript + React + FP) │ ├── ActivityFeed.tsx # 🔹 Лента
активности (TypeScript + React + FP) │ └── StatsOverview.tsx # 🔹 Обзор статистики (TypeScript +
React + FP) ├── hooks/ # 🔹 Общие React hooks │ ├── useTenant.ts # 🔹 Tenant hook (TypeScript +
React + FP + Effect) │ ├── useFeatureFlags.ts # 🔹 Feature flag hook (TypeScript + React + FP +
Effect) │ ├── usePermissions.ts # 🔹 Permission hook (TypeScript + React + FP + Effect) │ ├──
useFormProvider.ts # 🔹 Единый FormProvider для консистентного state management (TypeScript +
React + FP + Effect) │ └── feature-hooks.ts # 🔹 Повторяющиеся hooks между features (TypeScript +
React + FP + Effect) └── context/ # 🔹 Общие context провайдеры ├── TenantContext.tsx # 🔹
Tenant-aware context (TypeScript + React + FP + Effect) ├── FeatureFlagContext.tsx # 🔹 Feature
flags context (TypeScript + React + FP + Effect) └── index.ts # 🔹 Экспорт всех context провайдеров

---

## 🎯 ПРИНЦИП РАБОТЫ APPS/SHARED/

**apps/shared-ui/ — это локальный "shared layer" для фронтенда**

- ✅ **Не npm пакет** - не публикуется в registry
- ✅ **Локальная директория** - доступна через относительные импорты
- ✅ **DRY principle** - централизует общие ресурсы
- ✅ **Zero runtime dependencies** - только экспортирует чистые модули

### 🔄 ИМПОРТЫ В ПРИЛОЖЕНИЯХ:

```typescript
// Относительные импорты
import { UserApiDTO } from '../shared/dto/UserApiDTO';
import { UserMapper } from '../shared/mappers/UserMapper';

// Через алиасы (рекомендуется)
import { UserApiDTO, UserMapper } from '@shared/dto';
import { useTenant } from '@shared/hooks';
```

### 🎯 ЦЕЛИ APPS/SHARED/:

1. **Центральное место** для общих DTO и мапперов
2. **Общие React hooks** и контексты
3. **Общие UI-компоненты** (atoms/molecules/organisms)
4. **Избежать дублирования** между admin-panel, web, mobile

### 📋 ПРАВИЛА ИСПОЛЬЗОВАНИЯ:

- ✅ **Чистые модули** - нет side effects, нет runtime-зависимостей
- ✅ **Только экспорты** - apps/shared-ui/ ничего не импортирует сам
- ✅ **Приложения импортируют** только нужное из shared/
- ✅ **Workspace dependencies** - через package.json workspaces

---

## 🔄 ИНТЕГРАЦИЯ С ПРИЛОЖЕНИЯМИ

### 📱 ADMIN-DASHBOARD (Next.js)

```typescript
// apps/admin-panel/components/UserTable.tsx
import { Button, Table } from '../../shared/ui/atoms';
import { UserApiDTO, UserMapper } from '../../shared/dto';
import { useTenant } from '../../shared/hooks';
```

### 🌐 WEB APP (Next.js)

```typescript
// apps/web/features/user-profile/api.ts
import { UserApiDTO } from '../../../shared/dto';
import { UserMapper } from '../../../shared/mappers';
import { useTenant } from '../../../shared/hooks';
```

### 📲 MOBILE APP (React Native)

```typescript
// apps/mobile/features/auth/login.tsx
import { useTenant } from '../../shared/hooks';
import { UserApiDTO } from '../../shared/dto';
// Mobile может использовать только часть shared ресурсов
```

---

## 🎯 АРХИТЕКТУРНЫЕ ПРЕИМУЩЕСТВА

### ✅ DRY PRINCIPLE:

- **Нет дублирования** DTO между приложениями
- **Централизованная** логика маппинга
- **Общие UI компоненты** для admin/web

### ✅ TYPE SAFETY:

- **Общие контракты** API через shared DTO
- **TypeScript strict** - ошибки компиляции при изменениях
- **Runtime validation** через Zod schemas

### ✅ MULTI-TENANT READY:

- **Tenant context** через shared hooks
- **Feature flags** через shared context
- **Permissions** через shared hooks

### ✅ MAINTAINABILITY:

- **Single source of truth** для общих ресурсов
- **Easy refactoring** - изменения в одном месте
- **Workspace hot reload** - изменения сразу видны

---

## 🛠️ НАСТРОЙКА WORKSPACE

### 📄 package.json (корень проекта)

```json
{
  "workspaces": ["apps/*", "packages/*"]
}
```

### 📄 tsconfig.json (корень проекта)

```json
{
  "compilerOptions": {
    "paths": {
      "@shared/*": ["apps/shared-ui/*"],
      "@livai/sdk": ["packages/sdk/src"]
    }
  }
}
```

### 📄 apps/admin-panel/package.json

```json
{
  "dependencies": {
    "@livai/sdk": "workspace:*"
  }
}
```

---

## 🚀 МИГРАЦИЯ СУЩЕСТВУЮЩЕГО КОДА

### 📋 ПЛАН МИГРАЦИИ:

1. **Создать apps/shared-ui/** с базовой структурой
2. **Переместить дублированный код** из apps в shared/
3. **Обновить импорты** во всех приложениях
4. **Протестировать** workspace dependencies
5. **Настроить** TypeScript paths для @shared/\*

### 🎯 ПОСТЕПЕННАЯ МИГРАЦИЯ:

```bash
# Шаг 1: Создать пустые папки
mkdir -p apps/shared-ui/{dto,mappers,ui,hooks,context}

# Шаг 2: Начать с DTO
mv apps/web/dto/UserApiDTO.ts apps/shared-ui/dto/
mv apps/admin-panel/dto/UserApiDTO.ts apps/shared-ui/dto/

# Шаг 3: Обновить импорты
# apps/web/... → import { UserApiDTO } from '../../../shared/dto'
# apps/admin-panel/... → import { UserApiDTO } from '../../shared-apps/dto'
```

---

## 🎯 ЗАКЛЮЧЕНИЕ

**apps/shared-ui/ = Идеальный баланс для LivAiBot**

✅ **Startup-friendly** - быстрый старт без npm overhead\
✅ **Enterprise-ready** - подготовка к масштабированию\
✅ **DRY principle** - нет дублирования кода\
✅ **Type safety** - общие контракты и типы\
✅ **Maintainability** - легко поддерживать и рефакторить

**Это оптимальное решение для multi-app frontend архитектуры!** 🚀

**LivAiBot shared frontend layer готов!** ✨
