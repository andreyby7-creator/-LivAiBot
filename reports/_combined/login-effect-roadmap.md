# Дорожная карта: Реализация login-effect (Staff+/FAANG level)

**Цель:** Реализовать `packages/feature-auth/src/effects/login.ts` как production-grade orchestrator с соблюдением всех архитектурных инвариантов.

**Статус:** Планирование → Реализация

---

## 1️⃣ Зафиксировать контракт login-endpoint (schema-first) ✅

**1.1 Backend** ✅

Двухфазный, агрегат не возвращает:

- `POST /login` → `TokenPairResponse`
- `GET /me` → `MeResponse`

Агрегация выполняется только в effect-слое.
Без успешного `/me` → login невозможен (fail-closed).

**1.2 Transport (strict)** ✅

- `loginTokenPairSchema.strict()`
- `meResponseSchema.strict()`
- ❌ `.passthrough()`
- ❌ optional

Типы: `LoginTokenPairValues`, `MeResponseValues` — используются только в transport/feature.

**1.3 Feature (DTO)** ✅

```typescript
LoginResponseDto =
  | { type: 'success'; tokenPair; me }
  | { type: 'mfa_required'; challenge }
```

- `readonly`
- discriminated union
- нет optional
- `@version 1`
- `assertNever`
- создаётся только после успешных `/login` + `/me`

**1.4 Domain** ✅

```typescript
DomainLoginResult =
  | { type: 'success'; tokenPair: TokenPair; me: MeResponse }
  | { type: 'mfa_required'; challenge: MfaChallengeRequest }
```

- только domain-типы
- ❌ zod / DTO / any
- immutable
- fail-closed
- `@version 1`
- `assertNever`

Transport ↔ Domain mapping — явный и типобезопасный.

**1.5 Effect (оркестрация)** ✅

1. `/login` → strict validate
2. `/me` → strict validate
3. затем: DTO → Domain → storeUpdater → securityPipeline

Если `/me` падает →
нет `DomainLoginResult`, нет мутаций store, нет токенов, нет securityPipeline → `AuthError`.

**1.6 Инвариант (тест)** ✅

`/login` OK + `/me` fail →
`AuthError`, нет partial state, нет side-effects.

**📌 Итог:** ✅

- strict runtime validation
- чёткое разделение Transport / Feature / Domain
- immutable discriminated unions
- двухфазный deterministic flow
- fail-closed зафиксирован тестом
- MFA-ready

---

## 2️⃣ Устранить Record из domain/LoginRiskAssessment.ts

**Задача:** Убрать `Record<string, unknown>` из domain-слоя, оставив только семантический результат оценки риска.

---

### 2.1 Принять архитектурное решение

**✅ 2.1.1 Domain хранит только семантический результат:**

- ✅ `score: RiskScore` (0-100) - branded type с валидацией
- ✅ `level: RiskLevel` (low | medium | high | critical)
- ✅ `decision: LoginDecision` ('login' | 'mfa' | 'block') - вычисляется через deriveLoginDecision(level)
- ✅ `reasons: readonly RiskReason[]` — всегда массив (даже пустой) для explainability
- ✅ `modelVersion: RiskModelVersion` - branded type с валидацией

**✅ 2.1.2 ❌ Domain не хранит signals вообще**

Сигналы = инфраструктурный / классификационный слой.\
Domain получает только агрегированный результат вычислений.

---

### 2.2 Удалить signals из Domain

**✅ 2.2.1 В `domain/LoginRiskAssessment.ts` удалить:**

```typescript
// Удалено: signals отсутствуют в domain типах
```

**✅ 2.2.2 Если нужно сохранить объяснимость, ввести:**

```typescript
readonly reasons: readonly RiskReason[]; // Всегда массив (не опциональный)
```

где:

```typescript
export type RiskReason =
  | { type: 'network'; code: 'vpn' | 'tor' | 'proxy'; }
  | { type: 'reputation'; code: 'low' | 'critical'; }
  | { type: 'geo'; code: 'velocity' | 'impossible_travel' | 'high_risk_country' | 'suspicious'; }
  | { type: 'device'; code: 'unknown' | 'anomaly'; }
  | { type: 'behavior'; code: 'high_velocity'; };
```

**✅ Без generic-map структур.** - Используется closed-set union с категоризацией

**✅ 2.2.3 Финальная структура `LoginRiskEvaluation` (явная композиция):**

```typescript
export type LoginRiskResult = {
  readonly score: RiskScore; // 0-100 (branded type)
  readonly level: RiskLevel;
  readonly decision: LoginDecision; // Вычисляется через deriveLoginDecision(level)
  readonly reasons: readonly RiskReason[]; // Всегда массив
  readonly modelVersion: RiskModelVersion; // Branded type
};

export type LoginRiskContext = {
  readonly userId?: string;
  readonly ip?: string;
  readonly geo?: GeoInfo;
  readonly device?: DeviceRiskInfo;
  readonly userAgent?: string;
  readonly previousSessionId?: string;
  readonly timestamp: number; // Epoch ms UTC
};

export type LoginRiskEvaluation = {
  readonly result: LoginRiskResult;
  readonly context: LoginRiskContext;
};
// ✅ НЕТ signals - явная композиция result + context
```

---

### 2.3 Привести adapter к чистой трансформации

**2.3.1 В `login-risk-assessment.adapter.ts`:**

- [ ] Удалить `mapSignalsToRecord`
- [ ] Удалить локальный `RiskSignals` (строки 33-49)
- [ ] Использовать единый `RiskSignals` из `types/auth-risk.ts` (который = `ClassificationSignals`)

**2.3.2 `buildAssessment` должен:**

**Важно:** `buildAssessment` **не вычисляет** score/level/decision — это делает `assessClassification` из domains.

```typescript
buildAssessment(
  deviceInfo: DeviceInfo,
  context: { /* без signals */ },
  classificationResult: {
    riskScore: number,
    riskLevel: RiskLevel,
    triggeredRules: readonly ClassificationRule[],
  },
  mapperPlugin?: SignalsMapperPlugin, // опционально, для reasons если нужно
): LoginRiskAssessment
```

**Трансформация:**

```
ClassificationEvaluationResult (из assessClassification)
    ↓
mapTriggeredRulesToReasons() → reasons
    ↓
DomainLoginRiskAssessment (score, level, decision, reasons)
```

**Никакие сигналы в domain не передаются.**

**2.3.3 Создать `mapTriggeredRulesToReasons`:**

```typescript
function mapTriggeredRulesToReasons(
  rules: readonly ClassificationRule[],
): readonly RiskReason[];
```

- Маппинг `rule.name` → `RiskReason.type`
- Обработка неизвестных правил (fallback или игнорирование)

---

### 2.4 Убрать Record из схем

**2.4.1 В `schemas.ts` удалить:**

```typescript
// Удалить:
signals: z.record(z.string(), z.unknown()).optional();
```

**2.4.2 Обновить `loginRiskAssessmentSchema`:**

- Либо без `signals` вообще
- Либо со строгим `reasons` union schema (если reasons введены)

```typescript
reasons: z.array(z.discriminatedUnion('type', [
  z.object({ type: z.literal('vpn_detected') }),
  z.object({ type: z.literal('low_reputation') }),
  // ... другие
])).optional();
```

---

### 2.5 Синхронизация типов

**2.5.1 Удалить дублирование `RiskSignals` в adapter**

- [ ] Удалить локальный `RiskSignals` из `login-risk-assessment.adapter.ts`
- [ ] Использовать `RiskSignals` из `types/auth-risk.ts` везде

**2.5.2 Использовать `ClassificationSignals` (через `RiskSignals` alias) везде**

- [ ] В adapter использовать `RiskSignals` из `types/auth-risk.ts`
- [ ] В `risk-assessment.ts` уже используется правильный тип

**2.5.3 Запретить index-signatures в domain**

- [ ] Настроить `noImplicitAny` в TypeScript
- [ ] Добавить ESLint rule для запрета `Record<string, unknown>` в domain

---

### 2.6 Обновить SecurityState

**2.6.1 Проверить все обращения:**

- [ ] Найти все места: `riskAssessment.signals?.[...]`
- [ ] Проверить `SecurityState.riskAssessment` (types/auth.ts:501)

**2.6.2 Заменить на:**

```typescript
// Было:
riskAssessment.signals?.['vpn'];

// Стало:
riskAssessment.reasons?.some((r) => r.type === 'vpn_detected');
```

или убрать зависимость, если не используется.

---

### 2.7 Обновить тесты

**2.7.1 Удалить индексный доступ:**

- [ ] Удалить: `assessment.signals?.['vpn']`
- [ ] Удалить: `assessment.signals?.['reputationScore']`
- [ ] Обновить все тесты в `LoginRiskAssessment.test.ts`
- [ ] Обновить тесты в `login-risk-assessment.adapter.test.ts`

**2.7.2 Проверять:**

```typescript
expect(assessment.score).toBe(85);
expect(assessment.level).toBe('high');
expect(assessment.decision).toBe('mfa');
expect(assessment.reasons).toContainEqual({ type: 'vpn_detected' });
```

---

### 2.8 Plugin-архитектура

**2.8.1 Plugins работают только в adapter**

- [ ] Plugins расширяют `RiskContext.signals` (тип `ClassificationSignals`)
- [ ] Plugins не знают о domain структуре

**2.8.2 Plugins возвращают:**

```typescript
Partial<ClassificationSignals>;
```

**2.8.3 Adapter агрегирует → Domain получает только итог**

```
Plugins → ClassificationSignals
    ↓
assessClassification() → ClassificationEvaluationResult
    ↓
buildAssessment() → DomainLoginRiskAssessment (без signals)
```

**Domain ничего не знает о плагинах.**

---

### 2.9 Обновить risk-assessment.ts

**2.9.1 В строке 499-509 изменить вызов `buildAssessment`:**

```typescript
// Было:
const assessment = buildAssessment(deviceInfo, {
  ...context,
  signals: context.signals, // ❌ убрать
});

// Стало:
const assessment = buildAssessment(
  deviceInfo,
  {
    userId: context.userId,
    ip: context.ip,
    geo: context.geo,
    userAgent: deviceInfo.userAgent,
    previousSessionId: context.previousSessionId,
    timestamp: context.timestamp,
    // ❌ НЕТ signals
  },
  {
    riskScore: classification.riskScore,
    riskLevel: classification.riskLevel,
    triggeredRules: classification.triggeredRules,
  },
);
```

**2.9.2 Обновить сигнатуру `buildAssessment`:**

- [ ] Принимать `classificationResult` вместо вычисления внутри
- [ ] Убрать параметр `signals` из context

---

### 2.10 Обновить RiskAssessmentResult

**2.10.1 Проверить `RiskAssessmentResult.assessment`:**

- [ ] `RiskAssessmentResult.assessment: LoginRiskAssessment` — после изменений не будет содержать `signals`
- [ ] Обновить JSDoc в `types/auth-risk.ts` для `RiskAssessmentResult`

**2.10.2 Структура `assessment` после изменений:**

```typescript
{
  score: number,
  level: RiskLevel,
  decision: 'login' | 'mfa' | 'block',
  reasons?: readonly RiskReason[],
  // ... другие поля контекста
  // ❌ НЕТ signals
}
```

---

### 2.11 Обратная совместимость (если LoginRiskAssessment сериализуется)

**2.11.1 Если assessment хранится в БД/кэше:**

- [ ] Определить стратегию миграции: удалить `signals` или игнорировать при десериализации
- [ ] Обновить схемы десериализации

**2.11.2 Если assessment передается через API:**

- [ ] Обновить API контракт (версионирование если нужно)
- [ ] Обновить клиентские типы
- [ ] Обновить документацию API

---

### 2.12 Зафиксировать decision как derived, а не произвольное поле

**⚠️ Критично:** `decision` не должен передаваться извне — это вычисляемое значение.

**2.12.1 `decision` вычисляется строго из `level`:**

```typescript
type LoginDecision = 'login' | 'mfa' | 'block';

function deriveDecision(level: RiskLevel): LoginDecision {
  switch (level) {
    case 'critical':
    case 'high':
      return 'block';
    case 'medium':
      return 'mfa';
    case 'low':
      return 'login';
  }
}
```

**2.12.2 В domain нельзя передавать `decision` отдельно:**

- [ ] `buildAssessment` **не принимает** `decision` как параметр
- [ ] `decision` вычисляется внутри `buildAssessment` из `riskLevel`
- [ ] Тип `LoginRiskAssessment` содержит `decision`, но он всегда derived

**2.12.3 В `buildAssessment`:**

```typescript
const decision = deriveDecision(classificationResult.riskLevel);

return {
  score: classificationResult.riskScore,
  level: classificationResult.riskLevel,
  decision, // ← вычислено из level
  // ...
};
```

**❗ Domain не принимает `decision` снаружи.**

---

### 2.13 Зафиксировать closed-set для RiskReason

**⚠️ Критично:** Открытый список причин (`// ... другие`) позволяет plugins протащить динамику в domain.

**2.13.1 Убрать «другие причины»:**

- [ ] `RiskReason` = строго enum-like union, **без** `// ... другие`
- [ ] Закрытый список всех возможных причин

**2.13.2 Полный список `RiskReason`:**

```typescript
type RiskReason =
  | { type: 'vpn_detected'; }
  | { type: 'tor_detected'; }
  | { type: 'proxy_detected'; }
  | { type: 'low_reputation'; }
  | { type: 'critical_reputation'; }
  | { type: 'geo_velocity'; }
  | { type: 'high_velocity'; }
  | { type: 'device_anomaly'; }
  | { type: 'unknown_device'; }
  | { type: 'suspicious_geo'; }
  | { type: 'high_risk_country'; }
  | { type: 'impossible_travel'; };
// ❌ НЕТ "других причин"
// ❌ НЕТ generic { type: string; ... }
```

**2.13.3 Обработка неизвестных правил:**

- [ ] Если `rule.name` не маппится в известный `RiskReason`:
  - **Вариант 1:** Игнорировать (не добавлять в `reasons`)
  - **Вариант 2:** Маппить в `{ type: 'rule_triggered'; rule: string }` (но это расширяет union)
- [ ] **Рекомендация:** Игнорировать неизвестные правила, логировать warning
- [ ] **Без `Record`** — даже для неизвестных правил

**2.13.4 В `mapTriggeredRulesToReasons`:**

```typescript
function mapTriggeredRulesToReasons(
  rules: readonly ClassificationRule[],
): readonly RiskReason[] {
  const reasons: RiskReason[] = [];

  for (const rule of rules) {
    const reason = mapRuleNameToReason(rule.name);
    if (reason !== undefined) {
      reasons.push(reason);
    }
    // Игнорируем неизвестные правила (не добавляем в reasons)
  }

  return Object.freeze(reasons);
}

function mapRuleNameToReason(ruleName: string): RiskReason | undefined {
  switch (ruleName) {
    case 'VPN_DETECTED':
      return { type: 'vpn_detected' };
    case 'TOR_DETECTED':
      return { type: 'tor_detected' };
    case 'LOW_REPUTATION':
      return { type: 'low_reputation' };
    // ... все известные правила
    default:
      return undefined; // Неизвестное правило → игнорируем
  }
}
```

**Иначе plugins снова протащат динамику в domain.**

---

### 2.14 Убрать инфраструктурные поля из domain (опционально, но желательно)

**⚠️ Критично:** `userId`, `ip`, `userAgent`, `timestamp` — это контекст, а не результат оценки.

**2.14.1 Чистый semantic domain:**

Если вы хотите **чистый semantic domain** (рекомендуется):

```typescript
// Чистый semantic domain:
export type LoginRiskAssessment = {
  readonly version: 1; // Версионирование для сериализации
  readonly score: number;
  readonly level: RiskLevel;
  readonly decision: LoginDecision; // derived из level
  readonly reasons?: readonly RiskReason[];
  // ❌ НЕТ userId, ip, geo, device, userAgent, timestamp
};
```

**2.14.2 Контекст остаётся в `RiskAssessmentResult`:**

```typescript
export type RiskAssessmentResult = {
  readonly riskScore: number;
  readonly riskLevel: RiskLevel;
  readonly triggeredRules: readonly ClassificationRule[];
  readonly decisionHint: {/* ... */};
  readonly assessment: LoginRiskAssessment; // ← только semantic результат
  // Контекст можно добавить отдельно, если нужно:
  readonly context?: {
    readonly userId?: string;
    readonly ip?: string;
    readonly geo?: GeoInfo;
    // ...
  };
};
```

**2.14.3 Альтернатива (если нужна обратная совместимость):**

Если нужно сохранить контекстные поля в `LoginRiskAssessment`:

- [ ] Чётко разделить: **semantic поля** (score, level, decision, reasons) vs **контекстные поля** (userId, ip, etc.)
- [ ] Документировать, что контекстные поля не влияют на оценку риска
- [ ] В будущем вынести контекст в отдельный тип

**Иначе domain снова станет транспортным контейнером.**

---

### 2.15 Immutable + freeze (runtime защита)

**⚠️ Критично:** Если это критичная безопасность, нужна runtime защита от мутаций.

**2.15.1 После `buildAssessment` делать `Object.freeze()`:**

```typescript
export function buildAssessment(
  // ...
): LoginRiskAssessment {
  const assessment: LoginRiskAssessment = {
    score: classificationResult.riskScore,
    level: classificationResult.riskLevel,
    decision: deriveDecision(classificationResult.riskLevel),
    reasons: mapTriggeredRulesToReasons(classificationResult.triggeredRules),
    // ...
  };

  // Runtime защита от мутаций
  return Object.freeze(assessment);
}
```

**2.15.2 Запретить мутацию `reasons`:**

- [ ] `reasons` должен быть `readonly` и frozen
- [ ] После `mapTriggeredRulesToReasons` делать `Object.freeze(reasons)`
- [ ] Проверить, что вложенные объекты тоже frozen (если есть)

**2.15.3 В `mapTriggeredRulesToReasons`:**

```typescript
function mapTriggeredRulesToReasons(
  rules: readonly ClassificationRule[],
): readonly RiskReason[] {
  const reasons: RiskReason[] = [];
  // ... маппинг
  return Object.freeze(reasons); // ← freeze результат
}
```

**Иначе кто-то может модифицировать `assessment` после вычисления.**

---

### 2.16 Compile-time запрет Record в domain

**⚠️ Критично:** Только TS конфиг недостаточно — нужна ESLint rule.

**2.16.1 TypeScript конфиг:**

- [ ] `noImplicitAny: true`
- [ ] Строгие проверки типов

**2.16.2 ESLint rule для запрета `Record`:**

Добавить в `.eslintrc`:

```json
{
  "rules": {
    "no-restricted-syntax": [
      "error",
      {
        "selector": "TSTypeReference[typeName.name='Record']",
        "message": "Record запрещён в domain. Используйте строго типизированные union types."
      }
    ]
  },
  "overrides": [
    {
      "files": ["**/domain/**/*.ts"],
      "rules": {
        "no-restricted-syntax": [
          "error",
          {
            "selector": "TSTypeReference[typeName.name='Record']",
            "message": "Record запрещён в domain. Используйте строго типизированные union types."
          }
        ]
      }
    }
  ]
}
```

**2.16.3 Проверка в CI:**

- [ ] Добавить проверку ESLint в CI pipeline
- [ ] Fail build если найден `Record` в domain

**Иначе через год это вернётся.**

---

### 2.17 Проверить логику explainability

**⚠️ Критично:** `reasons` должны отражать все важные правила, влияющие на score.

**2.17.1 Убедиться, что `reasons` не теряют важную информацию:**

- [ ] Все правила из `triggeredRules` должны маппиться в `reasons` (если известны)
- [ ] Не должно быть silent-drop правил (правило влияет на score, но не попадает в reasons)
- [ ] Проверить, что все критичные правила (block-level) попадают в reasons

**2.17.2 Тесты для полноты explainability:**

```typescript
it('should map all triggered rules to reasons', () => {
  const rules: ClassificationRule[] = [
    { name: 'VPN_DETECTED', /* ... */ },
    { name: 'LOW_REPUTATION', /* ... */ },
  ];
  
  const reasons = mapTriggeredRulesToReasons(rules);
  
  expect(reasons).toHaveLength(2);
  expect(reasons).toContainEqual({ type: 'vpn_detected' });
  expect(reasons).toContainEqual({ type: 'low_reputation' });
});

it('should not drop rules that affect score', () => {
  // Если правило влияет на score, оно должно быть в reasons
  const classification = assessClassification(/* ... */);
  const assessment = buildAssessment(/* ... */, classification);
  
  // Проверяем, что все triggeredRules отражены в reasons
  expect(assessment.reasons?.length).toBeGreaterThanOrEqual(
    classification.triggeredRules.length
  );
});
```

**2.17.3 Проверка соответствия:**

- [ ] Если `triggeredRules.length > 0`, то `reasons.length` должен быть `> 0` (для известных правил)
- [ ] Если `level === 'critical'`, должны быть соответствующие reasons
- [ ] Если `decision === 'block'`, должны быть причины блокировки в reasons

**Иначе explainability будет ложной.**

---

### 2.18 Ввести version в LoginRiskAssessment

**⚠️ Критично:** Если объект сериализуется, нужна версия для будущих изменений schema.

**2.18.1 Добавить `version` в `LoginRiskAssessment`:**

```typescript
export type LoginRiskAssessment = {
  readonly version: 1; // ← версия schema
  readonly score: number;
  readonly level: RiskLevel;
  readonly decision: LoginDecision;
  readonly reasons?: readonly RiskReason[];
  // ...
};
```

**2.18.2 Обновить схему:**

```typescript
export const loginRiskAssessmentSchema = z.object({
  version: z.literal(1), // ← строго версия 1
  score: z.number().min(0).max(100),
  level: z.enum(['low', 'medium', 'high', 'critical']),
  decision: z.enum(['login', 'mfa', 'block']),
  reasons: z.array(/* ... */).optional(),
  // ...
}).strict();
```

**2.18.3 Миграция при будущих изменениях:**

- [ ] При изменении schema увеличить version
- [ ] Поддержка десериализации старых версий (если нужно)
- [ ] Документировать breaking changes между версиями

**Иначе при будущих изменениях schema будет больно.**

---

### 2.19 Инвариант (финальный)

После изменений:

- ✅ В domain нет `Record<string, unknown>`
- ✅ Нет index signatures
- ✅ Нет generic-map структур
- ✅ Domain детерминирован
- ✅ Domain не зависит от структуры внешних сигналов
- ✅ Любое расширение сигналов не меняет domain
- ✅ `buildAssessment` не вычисляет, а только трансформирует уже вычисленные значения
- ✅ `reasons` маппируются из `triggeredRules`, а не из signals
- ✅ Все сигналы остаются в adapter/classification слое
- ✅ `decision` вычисляется из `level`, не передаётся извне
- ✅ `RiskReason` — closed-set union, без динамики
- ✅ Runtime защита через `Object.freeze()`
- ✅ Compile-time защита через ESLint rule
- ✅ Полнота explainability проверена тестами
- ✅ Версионирование для сериализации

---

## 3️⃣ Определить DI-контракт login-эффекта

**Задача:** Создать типы зависимостей до реализации.

**Действия:**

- [ ] Создать `LoginStorePort` интерфейс (не конкретный Zustand-тип):
  ```typescript
  type LoginStorePort = {
    setAuthState: (state: AuthState) => void;
    setSessionState: (state: SessionState | null) => void;
    setSecurityState: (state: SecurityState) => void;
    applyEventType: (type: AuthEvent['type']) => void;
  };
  ```
- [ ] Создать `LoginEffectDeps`:
  ```typescript
  type LoginEffectDeps = {
    apiClient: ApiClient;
    authStore: LoginStorePort; // порт, не конкретный тип
    securityPipeline: (
      context: SecurityPipelineContext,
      policy?: RiskPolicy,
    ) => Effect<SecurityPipelineResult>; // обёртка над executeSecurityPipeline с фиксированными env/плагинами
    identifierHasher: IdentifierHasher;
    auditLogger: MandatoryAuditLogger;
    clock: () => number; // epoch ms — для детерминизма, меньше surface area чем Date
  };
  ```
- [ ] Создать `LoginEffectConfig`:
  ```typescript
  type LoginEffectConfig = {
    timeouts: {
      loginApiTimeoutMs: number; // для POST /v1/auth/login
      meApiTimeoutMs: number; // для GET /v1/auth/me
      // validate и metadata без таймаута или минимальный фиксированный
    };
    security: SecurityPipelineConfig; // failClosed: true в prod
    featureFlags?: Readonly<LoginFeatureFlags>;
    // policyMode на уровне композиции, login-effect не знает о режимах безопасности
  };
  ```
- [ ] Убедиться: никаких глобальных констант и `overallTimeoutMs`

**Критерии готовности:**

- ✅ Типы `LoginEffectDeps` и `LoginEffectConfig` определены
- ✅ `LoginStorePort` — порт, не конкретная реализация
- ✅ `securityPipeline` типизирован как обёртка с фиксированными параметрами
- ✅ В config нет generic `Record` и глобальных констант/overallTimeoutMs

---

## 4️⃣ Создать effects/login/login-api.mapper.ts

**Задача:** Чистый маппинг transport ↔ domain.

**Действия:**

- [ ] Создать файл `packages/feature-auth/src/effects/login/login-api.mapper.ts`
- [ ] Реализовать `mapLoginRequestToApiPayload(LoginRequest): LoginRequestValues`
- [ ] Реализовать `mapLoginResponseToDomain(LoginResponseDto): DomainLoginResult`
- [ ] Требования:
  - ❌ Никакой логики store
  - ❌ Никакой логики security
  - ❌ Нет доступа к `SecurityPipelineResult`
  - ✅ Только mapping transport ↔ domain
  - ✅ Строгие return-типы (никаких частичных объектов)
  - ✅ Pure функции, без side-effects
  - ✅ Нормализация enum-like строк в union-типы, дат и массивов → readonly
  - ❌ Никаких `try/catch` и default fallback — если данные невалидны, это bug схемы

**Критерии готовности:**

- ✅ Файл создан с двумя чистыми функциями
- ✅ Все типы строгие, без `Partial<>` в возвращаемых значениях
- ✅ Нет зависимостей от store/security/telemetry

---

## 5️⃣ Создать effects/login/login-store-updater.ts

**Задача:** Единая точка переходов состояния.

**Действия:**

- [ ] Создать файл `packages/feature-auth/src/effects/login/login-store-updater.ts`
- [ ] Реализовать функцию:
  ```typescript
  updateLoginState(
    store: LoginStorePort,
    securityResult: SecurityPipelineResult,
    domainResult: DomainLoginResult, // один union-тип, не несколько вариантов
    metadata?: LoginMetadata[]
  ): void
  ```
- [ ] Внутри функции:
  - Разделить внутреннюю реализацию на:
    - `applySuccessState` (гарантирует наличие `tokenPair` и `me` — оба обязательны)
    - `applyMfaState` (зарезервировано для будущего)
    - `applyBlockedState`
  - Вызовы `setAuthState`, `setSessionState`, `setSecurityState`, `applyEventType`
  - Использование готового `SecurityPipelineResult` (не пересчёт risk)
- [ ] Требования:
  - ❌ Без fallback'ов (`id: ''` запрещено)
  - ❌ Никаких `try/catch` — ошибки должны приходить валидированными
  - ❌ Не дублировать rule-engine из store
  - ❌ Не вычислять risk заново
  - ❌ Не читать текущее состояние и не принимать решения (decision уже сделан выше)
  - ✅ Метаданные передаются уже нормализованными
  - ✅ `DomainLoginResult.success` гарантированно содержит `tokenPair` и `me` (никаких partial состояний)

**Критерии готовности:**

- ✅ Файл создан с функцией `updateLoginState`
- ✅ Все переходы состояния через store actions
- ✅ Нет fallback-значений и пересчёта risk
- ✅ Success-состояние гарантирует наличие обоих полей (`tokenPair` и `me`)
- ✅ Store update атомарен (см. 5.1)

**5.1 Транзакционность store update:**

**⚠️ Критично:** Store update не должен оставлять промежуточных состояний.

- [ ] Если используется Zustand или подобное:
  - **Вариант 1:** Один batched update (все изменения в одной транзакции)
  - **Вариант 2:** Гарантированно последовательные вызовы без промежуточных re-render
- [ ] Реализация:
  ```typescript
  // Zustand batch update:
  store.setState({
    authState: newAuthState,
    sessionState: newSessionState,
    securityState: newSecurityState,
  }, true); // true = replace, не merge

  // Или через batch helper:
  batch(() => {
    store.setAuthState(newAuthState);
    store.setSessionState(newSessionState);
    store.setSecurityState(newSecurityState);
  });
  ```
- [ ] Проверить, что нет промежуточных состояний:
  - После `setAuthState` но до `setSessionState` — состояние не должно быть видно
  - Все изменения применяются атомарно
- [ ] Добавить тесты для проверки атомарности

**Store update не оставляет промежуточных состояний.**

---

## 6️⃣ (Опционально) Вынести login-security-policy

**Задача:** Клиентская policy поверх security-pipeline.

**Условие:** Только если нужна дополнительная policy поверх `executeSecurityPipeline`.

**Действия:**

- [ ] Создать `packages/feature-auth/src/effects/login/login-security-policy.ts`
- [ ] Реализовать:
  ```typescript
  evaluateLoginSecurityPolicy(
    result: SecurityPipelineResult,
    isProduction: boolean,
    policy: LoginSecurityPolicyConfig
  ): LoginSecurityDecision
  ```
- [ ] Тип:
  ```typescript
  type LoginSecurityDecision =
    | { type: 'block'; reason: string; }
    | { type: 'require_mfa'; }
    | { type: 'allow'; };
  ```
- [ ] Требования:
  - ✅ Pure-функция
  - ❌ Никаких store-вызовов
  - ❌ Никаких API-вызовов
  - ❌ Не читать featureFlags напрямую — получать уже рассчитанную policy

**Критерии готовности:**

- ✅ Файл создан (если нужен)
- ✅ Pure-функция без side-effects
- ✅ Используется в login.ts только для получения решения

---

## 7️⃣ Реализовать effects/login.ts как тонкий orchestrator

**Задача:** Основная реализация login-effect.

**Действия:**

- [ ] Создать файл `packages/feature-auth/src/effects/login.ts`
- [ ] Реализовать последовательность шагов через `orchestrate`:

  **Step 1 — validate-input:**
  - Использовать `isValidLoginRequest` и/или `loginRequestSchema`
  - Fail-fast, deterministic
  - **⚠️ Критично: Строгие схемы:**
    - Input schema strict (`.strict()`)
    - Output schema strict (`.strict()`)
    - Boundary полностью закрыта — никаких `.passthrough()` или optional без явной необходимости

  **Step 2 — security-pipeline:**
  - Вызов `executeSecurityPipeline` как атомарного шага
  - ❌ Не оборачивать в дополнительный timeout
  - Использовать `failClosed: true` в prod
  - ❌ Не дублировать risk-логику
  - **⚠️ Критично: Детерминизм security-pipeline:**
    - ❌ Никакого чтения текущего `authState` из store
    - ❌ Никаких скрытых global feature flags
    - ❌ Никаких прямых вызовов `Date.now()` или `new Date()` (использовать injected `clock`)
    - ✅ `securityPipeline` — pure относительно входного context + injected deps
    - ✅ Результат зависит только от входных параметров и injected зависимостей

  **Step 3 — security policy (если есть):**
  - Решение: `block` / `require_mfa` / `allow`
  - Если `block` → обновить store через updater и завершить
  - **⚠️ Критично: Источник MFA строго определён:**
    - MFA может возникнуть только из:
      - Backend `/login` (возвращает `mfa_required` в ответе)
      - Или `login-security-policy` (если есть)
    - ❌ Orchestrator **не генерирует MFA сам**
    - ❌ MFA не возникает из store или других источников
    - Источник MFA строго определён и документирован

  **Step 4 — enrich-metadata:**
  - Через `createLoginMetadataEnricher`
  - Использовать injected `identifierHasher` и `clock`
  - **⚠️ Критично: Clock тип:**
    - `clock: () => number` (epoch ms) — меньше surface area, чем `Date`
    - ❌ Не использовать `Date.now()` или `new Date()` напрямую
    - Использовать injected `clock` для детерминизма и тестируемости

  **Step 5 — validated API calls (двухфазный):**
  - **Step 5.1 — POST /v1/auth/login:**
    - `validatedEffect(loginTokenPairSchema, apiCall)`
    - `withTimeout` с `config.timeouts.loginApiTimeoutMs`
    - ❌ Никаких retry внутри эффекта
    - **⚠️ Критично: Retry-политика:**
      - Login-effect **не реализует retry**
      - Retry допускается только на уровне `ApiClient` (если вообще допускается)
      - ❌ Никаких `retry(3)` или подобных обёрток в orchestrator
      - Иначе через 6 месяцев кто-то добавит retry прямо в orchestrator
  - **Step 5.2 — GET /v1/auth/me:**
    - Использовать `access_token` из Step 5.1
    - `validatedEffect(meResponseSchema, apiCall)`
    - Отдельный `withTimeout` с `config.timeouts.meApiTimeoutMs`
    - ❌ Fail-closed: если `/me` упал — логин считается неуспешным (не делать fallback)
    - **⚠️ Критично: Атомарность токенов:**
      - `TokenPair` **не записывается в store** пока `GET /me` не завершился успешно
      - Инвариант: `TokenPair` не попадает в store до успешного `/me`
      - Иначе возможен half-auth state: токен есть, user нет, audit не сработал
  - **Step 5.3 — агрегация:**
    - Объединить `TokenPair` и `MeResponse` в `DomainLoginResult.success`
    - Только после успешного завершения обоих вызовов
    - **Только после агрегации** токены попадают в store (через Step 6)

  **Step 6 — store update:**
  - Через `login-store-updater`
  - ❌ Никакой бизнес-логики внутри login.ts

- [ ] Return-тип: строгий union `LoginResult` с полезным payload:
  ```typescript
  type LoginResult =
    | { type: 'success'; userId: UserId; }
    | { type: 'mfa_required'; challengeId: string; }
    | { type: 'blocked'; reason: string; }
    | { type: 'error'; error: AuthError; };
  ```
  - **⚠️ Критично: Error уже sanitized:**
    - `error: AuthError` — уже нормализован через error-mapper
    - ❌ Никогда не возвращается raw infrastructure error
    - ❌ Никогда не возвращается `unknown` или `Error` напрямую
    - Все ошибки проходят через `mapUnknownToAuthError` перед возвратом

**Критерии готовности:**

- ✅ Файл создан с полной последовательностью шагов
- ✅ Все шаги через `orchestrate` с isolation и timeout
- ✅ Return-тип — строгий union
- ✅ Нет бизнес-логики в orchestrator
- ✅ Store используется только в финальном шаге, без чтения состояния внутри шагов
- ✅ `securityPipeline` — pure относительно входного context + injected deps
- ✅ `TokenPair` не записывается в store до успешного `/me`
- ✅ Retry не реализуется в login-effect (только на уровне ApiClient)
- ✅ Источник MFA строго определён
- ✅ Login-effect защищён от параллельного выполнения (см. 7.1)
- ✅ Все ошибки sanitized перед возвратом

**7.1 Защита от параллельного выполнения (concurrency / re-entrancy):**

**⚠️ Production-критично:** Что если пользователь нажал login 3 раза, а предыдущий запрос ещё выполняется?

- [ ] Определить стратегию:
  - **Вариант 1:** Cancel previous (отменить предыдущий запрос)
  - **Вариант 2:** Ignore if running (игнорировать новый запрос, если уже выполняется)
  - **Вариант 3:** Serialize (поставить в очередь)
- [ ] Реализовать защиту:
  ```typescript
  let loginInProgress = false;
  let currentAbortController: AbortController | null = null;

  export async function loginEffect(...) {
    if (loginInProgress) {
      // Выбранная стратегия: cancel previous / ignore / serialize
      if (currentAbortController) {
        currentAbortController.abort();
      }
    }
    loginInProgress = true;
    currentAbortController = new AbortController();
    try {
      // ... выполнение
    } finally {
      loginInProgress = false;
      currentAbortController = null;
    }
  }
  ```
- [ ] Поведение должно быть **явно определено** и документировано
- [ ] Добавить тесты для concurrent вызовов

**Login-effect защищён от параллельного выполнения.**

---

## 8️⃣ Интегрировать error-mapper как единственный источник ошибок

**Задача:** Все ошибки через error-mapper (включая ошибки обоих API-вызовов).

**Действия:**

- [ ] В login.ts все три пути ошибок через helper `mapUnknownToAuthError`:
  - Ошибки API (через `mapAuthError`) — для обоих вызовов (`/login` и `/me`)
  - `SchemaValidationError` → валидировать и маппить как `unknown`/`policy_violation`
  - Инфраструктурные (`TimeoutError`, `IsolationError`, сетевые) → через правила `network`/`unknown`
- [ ] ❌ Никаких ручных `if (status === 401)` в login.ts
- [ ] ❌ Любая ошибка второго шага (`/me`) также проходит через error-mapper
- [ ] ❌ Не делать fallback типа "если `/me` упал — всё равно залогинить" — fail-closed: если `/me` не прошёл, логин считается неуспешным
- [ ] Sanitization только в error-mapper
- [ ] login.ts получает уже нормализованный `AuthError`

**Критерии готовности:**

- ✅ Все ошибки проходят через один helper `mapUnknownToAuthError`
- ✅ Нет ручной обработки HTTP-статусов
- ✅ Все ошибки типизированы как `AuthError`
- ✅ Ошибки обоих API-вызовов обрабатываются одинаково
- ✅ Все ошибки sanitized перед возвратом (никаких raw infrastructure errors)
- ✅ `error.message` и `error.details` не содержат sensitive данных

---

## 9️⃣ Принять единый timeout-policy

**Задача:** Устранить конфликты таймаутов.

**Действия:**

- [ ] Security timeout — только внутри `executeSecurityPipeline`
- [ ] API timeouts — два отдельных, в login.ts (через `withTimeout` и config):
  - `loginApiTimeoutMs` для `POST /v1/auth/login`
  - `meApiTimeoutMs` для `GET /v1/auth/me`
  - ❌ Не один общий timeout для обоих вызовов
- [ ] Validate и metadata — без таймаута (или минимальный фиксированный)
- [ ] Удалить любые legacy-константы типа `LOGIN_TIMEOUT_MS`
- [ ] Проверить, что нет нескольких уровней таймаутов

**Критерии готовности:**

- ✅ Таймауты определены в config (два отдельных для API)
- ✅ Нет legacy-констант
- ✅ Нет конфликтов между шагами

---

## 🔟 Интегрировать audit-логгер корректно

**Задача:** Audit через DI, без глобалов.

**Действия:**

- [ ] Передавать `MandatoryAuditLogger` в `security-pipeline`
- [ ] ❌ login.ts не использует `console.*`
- [ ] Audit должен фиксировать:
  - `login_success` только после успешного `/me` (не после получения `tokenPair`)
  - Иначе можно получить токены, но не загрузить профиль — система окажется в inconsistent state
- [ ] При ошибке/блокировке — формировать `AuthAuditEvent` через существующую схему
- [ ] Весь audit — через DI (`LoginEffectDeps.auditLogger`)
- [ ] Использовать отдельный mapper `mapLoginResultToAuditEvent(...)` — чтобы login.ts не содержал audit-структуру

**Критерии готовности:**

- ✅ Нет `console.*` в login.ts
- ✅ Audit через injected logger (интерфейс, не конкретная реализация)
- ✅ События формируются через `auditEventSchema` и отдельный mapper
- ✅ `login_success` фиксируется только после успешного `/me`

---

## 1️⃣1️⃣ Обновить public API feature-auth

**Задача:** Экспортировать login-effect.

**Действия:**

- [ ] В `packages/feature-auth/src/effects/index.ts`:
  - Экспортировать `createLoginEffect` или `loginEffect`
  - ❌ Не экспортировать внутренние мапперы и updater по умолчанию
  - (Только если это часть public API — экспортировать явно)

**Критерии готовности:**

- ✅ login-effect доступен через public API
- ✅ Внутренние модули не экспортируются по умолчанию

---

## 1️⃣2️⃣ Проверить архитектурные инварианты (Staff+ checklist)

**Задача:** Финальная проверка всех требований.

**Чек-лист:**

- [ ] ❌ Нет `Record` в domain
- [ ] ❌ Нет `console.*`
- [ ] ❌ Нет бизнес-логики в orchestrator
- [ ] ❌ Нет fallback-значений
- [ ] ❌ Нет дублирования risk-policy
- [ ] ❌ Нет нескольких уровней таймаутов
- [ ] ❌ Нет пересечения transport DTO и domain типов
- [ ] ❌ Нет mutable объектов в domain
- [ ] ❌ Нет прямых вызовов `Date.now()` и `new Date()` внутри effect-цепочки (используется `clock` из DI)
- [ ] ❌ Нет implicit `any` в effect-цепочке и orchestrator
- [ ] ✅ Deterministic
- [ ] ✅ Fail-closed security
- [ ] ✅ Rule-engine масштабируем
- [ ] ✅ Store — единственный владелец состояния
- [ ] ✅ Schema-validated boundary

**Критерии готовности:**

- ✅ Все пункты чек-листа пройдены
- ✅ Код готов к code review

---

## Порядок выполнения

**Рекомендуемая последовательность:**

1. **Пункты 1-3** (контракт, domain, DI) — сначала, до реализации
2. **Пункты 4-6** (мапперы, updater, policy) — вспомогательные модули
3. **Пункт 7** (основной orchestrator) — использует всё выше
4. **Пункты 8-10** (интеграции) — финальная интеграция
5. **Пункты 11-12** (API и проверка) — завершение

---

**Дата создания:** 2025-01-XX\
**Версия:** 1.0\
**Статус:** Планирование
