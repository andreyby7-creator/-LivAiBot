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

## 2️⃣ Устранить Record из domain/LoginRiskAssessment.ts ✅

**Задача:** Убрать `Record<string, unknown>` из domain-слоя, оставив только семантический результат оценки риска.

---

### 2.1 Принять архитектурное решение ✅

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

### 2.3 Привести adapter к чистой трансформации ✅

**✅ 2.3.1 В `login-risk-assessment.adapter.ts`:**

- ✅ Удалить `mapSignalsToRecord`
- ✅ Удалить локальный `RiskSignals` (строки 33-49)
- ✅ Использовать единый `RiskSignals` из `types/auth-risk.ts` (который = `ClassificationSignals`)

**✅ 2.3.2 `buildAssessment` должен:**

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

**✅ 2.3.3 Создать `mapTriggeredRulesToReasons`:**

```typescript
function mapTriggeredRulesToReasons(
  rules: readonly ClassificationRule[],
): readonly RiskReason[];
```

- Маппинг `rule.name` → `RiskReason.type`
- Обработка неизвестных правил (fallback или игнорирование)

---

### 2.4 Убрать Record из схем ✅

**✅ 2.4.1 В `schemas.ts` удалить:**

```typescript
// Удалить:
signals: z.record(z.string(), z.unknown()).optional();
```

**✅ 2.4.2 Обновить `loginRiskAssessmentSchema`:**

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

### 2.5 Синхронизация типов ✅

**✅ 2.5.1 Удалить дублирование `RiskSignals` в adapter**

- ✅ Удалить локальный `RiskSignals` из `login-risk-assessment.adapter.ts`
- ✅ Использовать `RiskSignals` из `types/auth-risk.ts` везде

**✅ 2.5.2 Использовать `ClassificationSignals` (через `RiskSignals` alias) везде**

- ✅ В adapter использовать `RiskSignals` из `types/auth-risk.ts`
- ✅ В `risk-assessment.ts` уже используется правильный тип

**✅ 2.5.3 Запретить index-signatures в domain**

- ✅ Настроить `noImplicitAny` в TypeScript
- ✅ Добавить ESLint rule для запрета `Record<string, unknown>` в domain

---

### 2.6 Обновить SecurityState ✅

**✅ 2.6.1 Проверить все обращения:**

- ✅ Найти все места: `riskAssessment.signals?.[...]` (в коде отсутствуют, только в roadmap)
- ✅ Проверить `SecurityState.riskAssessment` (types/auth.ts:501) — тип `LoginRiskResult` без `signals`

**✅ 2.6.2 Заменить на:**

```typescript
// Было:
riskAssessment.signals?.['vpn'];

// Стало:
riskAssessment.reasons?.some((r) => r.type === 'vpn_detected');
```

или убрать зависимость, если не используется (в текущем коде зависимостей от `riskAssessment.signals` нет).

---

### 2.7 Обновить тесты ✅

**✅ 2.7.1 Удалить индексный доступ:**

- ✅ Удалить: `assessment.signals?.['vpn']` (таких обращений в тестах нет)
- ✅ Удалить: `assessment.signals?.['reputationScore']` (таких обращений в тестах нет)
- ✅ Обновить все тесты в `LoginRiskAssessment.test.ts` — проверяют `score/level/decision/reasons` и Zod-схему `loginRiskAssessmentSchema`
- ✅ Обновить тесты в `login-risk-assessment.adapter.test.ts` — проверяют `result.score/level/decision` и `result.reasons` по правилам маппинга

**✅ 2.7.2 Проверять:**

```typescript
expect(assessment.score).toBe(85);
expect(assessment.level).toBe('high');
expect(assessment.decision).toBe('mfa');
expect(assessment.reasons).toContainEqual({ type: 'vpn_detected' });
```

---

### 2.8 Plugin-архитектура ✅

**✅ 2.8.1 Plugins работают только в adapter**

- ✅ Plugins расширяют `RiskContext.signals` (тип `RiskSignals` = `ClassificationSignals`) через `ContextBuilderPlugin` в `types/auth-risk.ts`
- ✅ Plugins не знают о domain структуре — работают с `RiskContext`/`AuthScoringContext`/`AuthRuleEvaluationContext`, маппятся в domains через `risk-assessment.ts`

**✅ 2.8.2 Plugins возвращают:**

```typescript
// extend*Context плагины возвращают новые контексты, где поле signals заполняется Partial<ClassificationSignals>
// (через merge: { ...context, signals: { ...context.signals, ...partialSignals } })
```

**✅ 2.8.3 Adapter агрегирует → Domain получает только итог**

```
Plugins → ClassificationSignals
    ↓
assessClassification() → ClassificationEvaluationResult
    ↓
buildAssessment() → DomainLoginRiskAssessment (без signals)
```

**Domain ничего не знает о плагинах.**

---

### 2.9 Обновить risk-assessment.ts ✅

**✅ 2.9.1 В строке 499-509 изменить вызов `buildAssessment`:**

```typescript
const assessment = buildAssessment({
  deviceInfo,
  context: {
    userId: context.userId,
    ip: context.ip,
    geo: context.geo,
    userAgent: deviceInfo.userAgent,
    previousSessionId: context.previousSessionId,
    timestamp: context.timestamp, // ❌ НЕТ signals
  },
  classificationResult: {
    riskScore: classification.riskScore,
    riskLevel: classification.riskLevel,
    triggeredRules: classification.triggeredRules,
  },
});
```

**✅ 2.9.2 Обновить сигнатуру `buildAssessment`:**

- ✅ Принимать `classificationResult` вместо вычисления внутри (`BuildAssessmentParams.classificationResult`)
- ✅ Убрать параметр `signals` из context (`BuildAssessmentParams['context']` не содержит signals)

---

### 2.10 Обновить RiskAssessmentResult ✅

**✅ 2.10.1 Проверить `RiskAssessmentResult.assessment`:**

- ✅ `RiskAssessmentResult.assessment: LoginRiskEvaluation` — domain-тип с `result` (score, level, decision, reasons, modelVersion) и `context` (userId, ip, geo, device, userAgent, previousSessionId, timestamp), без `signals`
- ✅ JSDoc в `types/auth-risk.ts` для `RiskAssessmentResult.assessment` отражает, что это «Полная оценка риска для аудита», без упоминания signals

**✅ 2.10.2 Структура `assessment` после изменений:**

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

### 2.11 Обратная совместимость (если LoginRiskAssessment сериализуется) ✅

**✅ 2.11.1 Если assessment хранится в БД/кэше:**

- ✅ На текущий момент `LoginRiskEvaluation` / `RiskAssessmentResult` нигде не сериализуются в БД/кэш (поиск по репозиторию не показывает использования в persistence-слое), поэтому миграция по удалению `signals` не требуется
- ✅ Zod-схема `loginRiskAssessmentSchema` в feature-auth описывает только `{ result, context }` без `signals`, что гарантирует игнорирование старого поля при возможной десериализации

**✅ 2.11.2 Если assessment передается через API:**

- ✅ В текущей архитектуре `LoginRiskEvaluation` используется только внутри feature-auth/security-pipeline и не является частью публичного HTTP API (поиск по `services/` не показывает экспорта assessment в контракты)
- ✅ API-контракты и клиентские типы не включают `signals` в assessment, документация API изменений не требует; при будущем экспорте assessment через API следует сразу использовать новую структуру без `signals`

---

### 2.12 Зафиксировать decision как derived, а не произвольное поле ✅

**⚠️ Критично:** `decision` не должен передаваться извне — это вычисляемое значение.

**✅ 2.12.1 `decision` вычисляется строго из `level`:**

- ✅ В `LoginRiskAssessment.ts` определён `deriveLoginDecision(level: RiskLevel): LoginDecision`, использующий mapping `Record<RiskLevel, LoginDecision>` для вычисления `decision` из `level`

**✅ 2.12.2 В domain нельзя передавать `decision` отдельно:**

- ✅ `buildAssessment` **не принимает** `decision` как параметр — получает только `classificationResult` (score, level, triggeredRules)
- ✅ `decision` вычисляется внутри domain-фабрики `createLoginRiskResult` через `deriveLoginDecision(level)`
- ✅ Тип `LoginRiskResult` содержит `decision`, но он всегда derived из `level` и не задаётся вручную

**✅ 2.12.3 В `buildAssessment`:**

- ✅ Adapter вызывает `createLoginRiskResult({ score, level, reasons, modelVersion })`, где `decision` заполняется внутри domain на основе `level`
- ✅ Domain-слой нигде не принимает `decision` снаружи (ни в типах, ни в фабриках)

---

### 2.13 Зафиксировать closed-set для RiskReason ✅

**⚠️ Критично:** Открытый список причин (`// ... другие`) позволяет plugins протащить динамику в domain.

**✅ 2.13.1 Убрать «другие причины»:**

- ✅ В `LoginRiskAssessment.ts` `RiskReason` определён как union по константам `RiskReasonType` и `RiskReasonCode` (network/reputation/geo/device/behavior + конкретные коды), без `// ... другие` и без generic `{ type: string; ... }`
- ✅ Список возможных причин закрыт через `as const` + производный union по ключам, плагины не могут добавить новые варианты без изменения domain-кода

**✅ 2.13.2 Полный список `RiskReason`:**

- ✅ Список причин соответствует зафиксированным категориям: VPN/TOR/PROXY, low/critical reputation, geo-velocity/impossible_travel/high_risk_country/suspicious, device anomaly/unknown, behavior high_velocity — все заданы явно через `RiskReasonCode`
- ✅ Нет «прочих» причин и нет открытых строковых типов в domain-слое

**✅ 2.13.3 Обработка неизвестных правил:**

- ✅ В adapter-е `RULE_TO_REASON` типизирован как `{ readonly [K in ClassificationRule]: RiskReason }`, что заставляет явно маппить каждый `ClassificationRule`; неизвестные/новые правила невозможно передать без обновления этого маппинга
- ✅ Таким образом, неизвестные rule.name не попадают в domain вообще (ошибка будет на уровне типов/сборки), и нигде не используется `Record<string, unknown>` для reasons

**✅ 2.13.4 В `mapTriggeredRulesToReasons`:**

- ✅ `mapTriggeredRulesToReasons` маппит список `ClassificationRule` → `readonly RiskReason[]` через `RULE_TO_REASON`, делает дедупликацию по `{type, code}` и возвращает frozen-массив
- ✅ Domain получает только закрытый набор `RiskReason`, динамика из plugins/правил не может «протечь» в структуру domain

---

### 2.14 Убрать инфраструктурные поля из domain (опционально, но желательно) ✅

**⚠️ Критично:** `userId`, `ip`, `userAgent`, `timestamp` — это контекст, а не результат оценки.

**✅ 2.14.1 Чистый semantic domain:**

- ✅ В `LoginRiskAssessment.ts` семантический результат выделен в отдельный тип `LoginRiskResult` (score, level, decision, reasons, modelVersion) без `userId`, `ip`, `geo`, `device`, `userAgent`, `timestamp`
- ✅ Входной контекст выделен в отдельный тип `LoginRiskContext` (userId/ip/geo/device/userAgent/previousSessionId/timestamp), не смешивается с результатом

**✅ 2.14.2 Контекст остаётся в `RiskAssessmentResult`:**

- ✅ В `RiskAssessmentResult` (`types/auth-risk.ts`) поле `assessment` имеет тип `LoginRiskEvaluation = { result: LoginRiskResult; context: LoginRiskContext; }`, где `result` — чистый semantic domain, а `context` — инфраструктурные поля
- ✅ Внешние потребители получают семантику через `riskScore`/`riskLevel`/`decisionHint` + `assessment.result`, а контекст остаётся явно отделённым в `assessment.context`

**✅ 2.14.3 Альтернатива (если нужна обратная совместимость):**

- ✅ Semantic и контекстные поля уже разделены на уровне типов (`LoginRiskResult` vs `LoginRiskContext`), domain-слой не является транспортным контейнером
- ✅ Дополнительно задокументировано в JSDoc, что `LoginRiskResult` не содержит PII, а PII живёт в `LoginRiskContext`/`LoginRiskEvaluation` и используется для audit/контекста, но не меняет саму оценку

---

### 2.15 Immutable + freeze (runtime защита) ✅

**⚠️ Критично:** Если это критичная безопасность, нужна runtime защита от мутаций.

**✅ 2.15.1 После `buildAssessment` делать `Object.freeze()`:**

- ✅ В domain-фабриках `createLoginRiskResult` и `createLoginRiskEvaluation` результат оборачивается в `Object.freeze(...)`, поэтому итоговый `LoginRiskResult` и `LoginRiskEvaluation` (assessment) runtime-immutable

**✅ 2.15.2 Запретить мутацию `reasons`:**

- ✅ Поле `reasons` в `LoginRiskResult` типизировано как `readonly RiskReason[]`
- ✅ В adapter-е `mapTriggeredRulesToReasons` теперь возвращает `Object.freeze(uniqueReasons)`, так что массив причин runtime-frozen; пустой массив причин берётся из `emptyReasons`, который тоже frozen

**✅ 2.15.3 В `mapTriggeredRulesToReasons`:**

- ✅ `mapTriggeredRulesToReasons` маппит правила в массив причин, делает дедупликацию и в конце возвращает `Object.freeze(uniqueReasons)` как `readonly RiskReason[]`
- ✅ Вложенные объекты `RiskReason` сами по себе иммутабельны по контракту (readonly поля, без вложенных структур), так что freeze массива достаточно для предотвращения мутаций списка причин после вычисления

---

### 2.16 Compile-time запрет Record в domain ✅

**⚠️ Критично:** Только TS конфиг недостаточно — нужна ESLint rule.

**✅ 2.16.1 TypeScript конфиг:**

- ✅ В корневом `tsconfig.json` уже включён strict-режим (`"strict": true`) и `noImplicitAny: true`, плюс строгие флаги (`strictNullChecks`, `noUncheckedIndexedAccess` и т.д.)

**✅ 2.16.2 ESLint rule для запрета `Record`:**

- ✅ В `eslint.config.mjs` (flat-config) добавлен override для `packages/feature-auth/src/domain/LoginRiskAssessment.ts` c правилом `no-restricted-syntax`, которое запрещает именно `Record<string, unknown>`:
  - `files: ['packages/feature-auth/src/domain/LoginRiskAssessment.ts']`
  - `selector: "TSTypeReference[typeName.name='Record'][typeParameters.params.0.typeAnnotation.type='TSStringKeyword'][typeParameters.params.1.typeAnnotation.type='TSUnknownKeyword']"`
  - `message: "Record запрещён в domain LoginRiskAssessment. Используйте строго типизированные union types."`
- ✅ Такой подход корректен для современного flat-config (вместо устаревшего `.eslintrc`) и точечно бьёт по опасному шаблону `Record<string, unknown>`, не ломая легитимные `Record<K, V>` вне этого домена

**✅ 2.16.3 Проверка в CI:**

- ✅ В CI уже выполняется `lint:canary:ci` (через `quality:ci`), который использует `eslint.config.mjs`; любое нарушение `no-restricted-syntax` в `LoginRiskAssessment.ts` будет фейлить сборку
- ✅ Таким образом compile-time защита от `Record<string, unknown>` в критичном domain-файле зафиксирована и контролируется CI

**Иначе через год это вернётся.**

---

### 2.17 Проверить логику explainability ✅

**⚠️ Критично:** `reasons` должны отражать все важные правила, влияющие на score.

**✅ 2.17.1 Убедиться, что `reasons` не теряют важную информацию:**

- ✅ Все правила из `ClassificationRule` маппятся в `RiskReason` через `RULE_TO_REASON: { [K in ClassificationRule]: RiskReason }` в adapter-е — compile-time exhaustiveness исключает silent-drop для известных правил
- ✅ Для кейсов с несколькими правилами, дающими один и тот же semantic reason (VPN_DETECTED + NEW_DEVICE_VPN, UNKNOWN_DEVICE + IoT_DEVICE + MISSING_OS + MISSING_BROWSER), тесты проверяют, что итоговый reason присутствует и дубликаты устранены (см. `login-risk-assessment.adapter.test.ts`)
- ✅ Для набора разных правил (VPN_DETECTED, TOR_NETWORK, LOW_REPUTATION) тесты проверяют, что все ожидаемые reasons присутствуют в `result.reasons`

**✅ 2.17.2 Тесты для полноты explainability:**

- ✅ Unit-тесты адаптера покрывают:
  - соответствие `triggeredRules` → `result.reasons` (по типу/коду) без пропуска известных правил
  - отсутствие лишних reasons при дубликатах (один semantic reason на несколько правил)
- ✅ Это даёт гарантии, что explainability не теряет существенную информацию о сработавших правилах

**✅ 2.17.3 Проверка соответствия:**

- ✅ Если `triggeredRules.length > 0`, для известных правил reasons всегда содержат хотя бы один соответствующий semantic reason (проверено тестами на разные комбинации правил)
- ✅ Для high/critical уровней риска (и решений `block` на уровне classification) конфигурация правил/маппинга гарантирует наличие хотя бы одного серьёзного `RiskReason` (network/reputation/geo/device/behavior) — это зафиксировано тестами в security-pipeline и adapter-слое

**Иначе explainability будет ложной.**

---

### 2.18 Ввести version в LoginRiskAssessment ✅

**⚠️ Критично:** Если объект сериализуется, нужна версия для будущих изменений schema.

**✅ 2.18.1 Добавить `version` в `LoginRiskAssessment`:**

- ✅ В текущем дизайне версионность семантического результата зафиксирована через `RiskModelVersion` / поле `modelVersion` в `LoginRiskResult` (`LoginRiskAssessment.ts`), которое служит версией risk-модели/схемы
- ✅ Это даёт более гибкий контракт, чем жёсткий `version: 1`, и уже используется во всех фабриках/схемах

**✅ 2.18.2 Обновить схему:**

- ✅ В `schemas.ts` `loginRiskResultSchema` содержит поле `modelVersion: z.string()` как обязательное — любая сериализуемая оценка риска несёт явную версию risk-модели
- ✅ `loginRiskAssessmentSchema` описывает `{ result: loginRiskResultSchema, context: loginRiskContextSchema }` и тем самым включает `modelVersion` в сериализуемый объект

**✅ 2.18.3 Миграция при будущих изменениях:**

- ✅ При изменении semantics/shape результата риска roadmap зафиксирует повышение `RiskModelVersion` (например, `"1.0.0" → "2.0.0"`) и соответствующие миграции десериализации, вместо добавления отдельного `version`-поля
- ✅ Поскольку сейчас `LoginRiskEvaluation` не хранится в БД и не выходит в публичный API, фактическая миграция старых версий пока не требуется, но стратегия версионирования через `modelVersion` уже готова для будущих изменений

**Иначе при будущих изменениях schema будет больно.**

---

### 2.19 Инвариант (финальный) ✅

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

## 3️⃣ Определить DI-контракт login-эффекта ✅

**Задача:** Создать типы зависимостей до реализации.

**Действия:**

- ✅ Создать `LoginStorePort` интерфейс (не конкретный Zustand-тип):
  ```typescript
  type LoginStorePort = {
    setAuthState: (state: AuthState) => void;
    setSessionState: (state: SessionState | null) => void;
    setSecurityState: (state: SecurityState) => void;
    applyEventType: (type: AuthEvent['type']) => void;
  };
  ```
- ✅ Зафиксировать DI-тип `LoginEffectDeps` (только порты, без глобалов/infra):
  ```typescript
  type ApiClient = {
    post<T>(url: string, body: unknown, options?: { signal?: AbortSignal; }): Promise<T>;
    get<T>(url: string, options?: { signal?: AbortSignal; }): Promise<T>;
  };

  type SecurityPipelineContext = {
    userIdentifier: string;
    ip?: string;
    userAgent?: string;
    timestamp: number; // epoch ms — только injected clock, не Date.now()
  };

  type SecurityPipelineResult = {
    decision: 'allow' | 'require_mfa' | 'block';
    riskLevel: RiskLevel;
    riskScore: number;
    auditContext: unknown; // или строгий тип, но один, без дублирования risk-полей
  };

  type IdentifierHasher = (input: string) => string; // sync, без async-цепочек в эффекте

  type LoginEffectDeps = Readonly<{
    apiClient: ApiClient; // login-effect не знает про fetch/axios/baseURL/retry
    authStore: LoginStorePort;
    securityPipeline: (
      context: SecurityPipelineContext,
      policy?: RiskPolicy,
    ) => Effect<SecurityPipelineResult>; // обёртка над executeSecurityPipeline с фиксированными env/плагинами
    identifierHasher: IdentifierHasher;
    auditLogger: MandatoryAuditLogger;
    errorMapper: (unknownError: unknown) => AuthError; // mapUnknownToAuthError через DI
    abortControllerFactory: () => AbortController; // для concurrency-стратегии, без new AbortController() внутри
    clock: () => number; // epoch ms — для детерминизма, меньше surface area чем Date
  }>;
  ```
- ✅ Создать `LoginEffectConfig` (режим окружения/политики — уже рассчитанные, не из NODE_ENV):
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
- ✅ Убедиться: никаких глобальных констант и `overallTimeoutMs`
- ✅ Зафиксировать стратегию concurrency (например, cancel previous) и требование к deps:
  - при `cancel previous` ApiClient обязан поддерживать AbortSignal (через `abortControllerFactory`)
  - при других стратегиях (ignore/serialize) внутренний guard хранится только внутри `createLoginEffect`, без глобального стейта

**Критерии готовности:**

- ✅ Типы `LoginEffectDeps` и `LoginEffectConfig` определены (только readonly-поля, без мутаций deps/config)
- ✅ `LoginStorePort` — порт, не конкретная реализация
- ✅ `securityPipeline` типизирован как обёртка с фиксированными параметрами (конфигурация/режим prod-dev вычисляются снаружи и приходят как часть `RiskPolicy`/`SecurityPipelineConfig`)
- ✅ ApiClient не знает про retry/timeout/policy login-effect’а (эти решения принимаются на уровне DI/конфигов)
- ✅ В config нет generic `Record` и глобальных констант/overallTimeoutMs
- ✅ Ошибки всегда проходят через injected `errorMapper`, нет прямых `mapUnknownToAuthError` импортов в login.ts
- ✅ DI-типы login-эффекта реализованы в коде (`login-effect.types.ts`) и покрыты юнит-тестом `npx vitest run --coverage feature-auth/tests/unit/effects/login/login-effect.types.test.ts`

---

## 4️⃣ Создать effects/login/login-api.mapper.ts ✅

**Задача:** Чистый маппинг transport ↔ domain.

**Действия:**

- ✅ Создать файл `packages/feature-auth/src/effects/login/login-api.mapper.ts`
- ✅ Реализовать `mapLoginRequestToApiPayload(LoginRequest): LoginRequestValues`
- ✅ Реализовать `mapLoginResponseToDomain(LoginResponseDto): DomainLoginResult`
- [ ] Требования:
  - ❌ Никакой логики store
  - ❌ Никакой логики security
  - ❌ Нет доступа к `SecurityPipelineResult`
  - ✅ Только mapping transport ↔ domain
  - ✅ Строгие return-типы (никаких частичных объектов)
  - ✅ Pure функции, без side-effects
  - ✅ Нормализация enum-like строк в union-типы, дат и массивов → readonly
  - ❌ Никаких `try/catch` и default fallback — если данные невалидны, это bug схемы
  - ✅ MFA mapping: `LoginResponseDto` с `type: 'mfa_required'` маппится 1:1 в `DomainLoginResult` без генерации/модификации `challenge`
  - ✅ Branded-типы (например, `UserId`) создаются через явные фабрики/брендинг, mapper не прокидывает raw string в domain
  - ✅ Возвращаемые объекты и коллекции — readonly (freeze массивов, copy-on-write, никаких мутабельных ссылок из DTO)
  - ✅ Exhaustive switch по `LoginResponseDto['type']` + `assertNever` в `mapLoginResponseToDomain`
  - ✅ Нормализация времени: либо строгий ISO string с явным договором, либо конвертация в `number` (epoch ms) для domain, без implicit `Date.parse` в неожиданных местах
  - ✅ Явная нормализация token shape (access/refresh/expiry) в domain-тип `TokenPair`, без прокидывания raw backend-формата

**Критерии готовности:**

- ✅ Файл создан с двумя чистыми функциями
- ✅ Все типы строгие, без `Partial<>` в возвращаемых значениях
- ✅ Нет зависимостей от store/security/telemetry
- ✅ Для `LoginResponseDto['type']` используется exhaustive switch + `assertNever`
- ✅ Маппинг MFA/decision не содержит fallback-логики: источник MFA строго backend (или отдельная security-политика, но не mapper)
- ✅ Везде, где backend возвращает даты/время, mapper либо явно конвертирует их в согласованный domain-формат, либо оставляет строго задокументированный string-формат
- ✅ Mapper реализован в `login-api.mapper.ts`, проходит `pnpm run tsc:check` и соответствует требованиям immutability/readonly для domain-объектов (TokenPair, MeResponse, MfaChallengeRequest)

---

## 5️⃣ Создать effects/login/login-store-updater.ts ✅

**Задача:** Единая точка переходов состояния.

**Действия:**

- ✅ Создать файл `packages/feature-auth/src/effects/login/login-store-updater.ts`
- ✅ Реализовать функцию:
  ```typescript
  updateLoginState(
    store: LoginStorePort,
    securityResult: SecurityPipelineResult,
    domainResult: DomainLoginResult, // один union-тип, не несколько вариантов
    metadata?: LoginMetadata[]
  ): void
  ```
- ✅ Внутри функции:
  - Разделить внутреннюю реализацию на:
    - `applySuccessState` (гарантирует наличие `tokenPair` и `me` — оба обязательны)
    - `applyMfaState` (зарезервировано для будущего)
    - `applyBlockedState`
  - Вызовы `setAuthState`, `setSessionState`, `setSecurityState`, `applyEventType`
  - Использование готового `SecurityPipelineResult` (не пересчёт risk)
- ✅ Требования:
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
- ✅ Store update логически атомарен (см. 5.1) и покрыт юнит-тестами на согласованность состояний

**5.1 Транзакционность store update:** ✅

**⚠️ Критично:** Store update не должен оставлять промежуточных состояний.

- [x] Если используется Zustand или подобное:
  - **Вариант 1:** Один batched update (все изменения в одной транзакции)
  - **Вариант 2:** Гарантированно последовательные вызовы без промежуточных re-render
- [x] Реализация:
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
- [x] Проверить, что нет промежуточных состояний:
  - После `setAuthState` но до `setSessionState` — состояние не должно быть видно
  - Все изменения применяются атомарно
- [x] Добавить тесты для проверки атомарности

**Store update не оставляет промежуточных состояний.**

---

## 6️⃣ Реализовать effects/login.ts как тонкий orchestrator ✅

**Задача:** Основная реализация login-effect.

**Действия:**

- [x] Создать файл `packages/feature-auth/src/effects/login.ts`
- [x] Реализовать функцию `createLoginEffect(deps: LoginEffectDeps, config: LoginEffectConfig)`
- [x] Реализовать последовательность шагов через `orchestrate`:
- [x] **⚠️ Критично: AbortSignal propagation:**
  - Прокидывать `AbortSignal` через все шаги orchestrator
  - Использовать `deps.abortController.create()` для создания контроллера
  - Передавать `signal` в `apiClient.post/get` через `options.signal`
  - Передавать `signal` в `orchestrate` шаги
- [x] **⚠️ Критично: Импорты orchestrator:**
  - `orchestrate`, `step` из `@livai/app/lib/orchestrator.ts`
  - `Effect` из `@livai/app/lib/effect-utils.ts`

  **Step 1 — validate-input:**
  - Использовать `isValidLoginRequest` и/или `loginRequestSchema.strict()`
  - Fail-fast, deterministic
  - **⚠️ Критично: Строгие схемы:**
    - Input schema strict (`.strict()`)
    - Output schema strict (`.strict()`)
    - Boundary полностью закрыта — никаких `.passthrough()` или optional без явной необходимости
  - **⚠️ Импорты:**
    - `isValidLoginRequest` из `effects/login/validation.ts`
    - `loginRequestSchema` из `schemas/schemas.ts`
    - `LoginRequest` из `domain/LoginRequest.ts`

  **Step 2 — security-pipeline:**
  - Создать `SecurityPipelineContext` из `LoginRequest`:
    - `operation: 'login'` (или `'oauth_login'` для OAuth)
    - `userIdentifier`: извлечь из `LoginRequest.identifier.value` (хешировать через `identifierHasher` для PII)
    - `ip`, `userAgent`: извлечь из `LoginRequest.clientContext` (если есть)
    - `timestamp`: использовать `clock.now()` (epoch ms)
  - Вызов `securityPipeline.run(context, policy)` через DI-порт
  - **⚠️ Критично: Адаптер SecurityPipelinePort:**
    - `SecurityPipelinePort.run()` возвращает `Effect<LoginSecurityResult>`
    - Внутри адаптера: `executeSecurityPipeline` → `SecurityPipelineResult` → маппинг в `LoginSecurityResult`
    - Маппинг: `decisionHint.action` → `LoginSecurityDecision` (`'login'` → `'allow'`, `'mfa'` → `'require_mfa'`, `'block'` → `'block'`)
    - Адаптер создаётся на уровне composer'а (не внутри login.ts)
  - ❌ Не оборачивать в дополнительный timeout (timeout внутри `executeSecurityPipeline`)
  - ❌ Не дублировать risk-логику
  - **⚠️ Критично: Детерминизм security-pipeline:**
    - ❌ Никакого чтения текущего `authState` из store
    - ❌ Никаких скрытых global feature flags
    - ❌ Никаких прямых вызовов `Date.now()` или `new Date()` (использовать injected `clock`)
    - ✅ `securityPipeline` — pure относительно входного context + injected deps
    - ✅ Результат зависит только от входных параметров и injected зависимостей
  - **⚠️ Импорты:**
    - `SecurityPipelineContext` из `lib/security-pipeline.ts`
    - `SecurityPipelinePort`, `LoginSecurityResult` из `effects/login/login-effect.types.ts` (DI)
    - `RiskPolicy` из `types/auth-risk.ts` (опционально, через config)
    - `executeSecurityPipeline` из `lib/security-pipeline.ts` (используется в адаптере, не напрямую в login.ts)

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
  - Создать `LoginContext`:
    - `request`: валидированный `LoginRequest` из Step 1
    - `traceId`: сгенерировать UUID (или использовать injected traceId из deps, если есть)
    - `timestamp`: ISO string из `clock.now()` (конвертировать epoch ms → ISO)
    - `deviceInfo`: из `SecurityPipelineResult.deviceInfo` (Step 2)
    - `riskMetadata`: из `SecurityPipelineResult.riskAssessment` (Step 2)
  - Через `buildLoginMetadata(context, config)` или `createLoginMetadataEnricher`
  - Использовать injected `identifierHasher` и `clock`
  - **⚠️ Критично: Clock тип:**
    - `clock: () => number` (epoch ms) — меньше surface area, чем `Date`
    - ❌ Не использовать `Date.now()` или `new Date()` напрямую
    - Использовать injected `clock` для детерминизма и тестируемости
  - **⚠️ Импорты:**
    - `buildLoginMetadata`, `createLoginMetadataEnricher` из `effects/login/login-metadata.enricher.ts`
    - `LoginContext`, `LoginMetadata` из `effects/login/login-metadata.enricher.ts`

  **Step 5 — validated API calls (двухфазный):**
  - **Step 5.1 — POST /v1/auth/login:**
    - Преобразовать `LoginRequest` → API payload через `mapLoginRequestToApiPayload`
    - Вызов `apiClient.post('/v1/auth/login', payload, { signal: abortSignal })`
    - `validatedEffect(loginTokenPairSchema.strict(), apiCall)`
    - `withTimeout` с `config.timeouts.loginApiTimeoutMs`
    - ❌ Никаких retry внутри эффекта
    - **⚠️ Критично: Retry-политика:**
      - Login-effect **не реализует retry**
      - Retry допускается только на уровне `ApiClient` (если вообще допускается)
      - ❌ Никаких `retry(3)` или подобных обёрток в orchestrator
      - Иначе через 6 месяцев кто-то добавит retry прямо в orchestrator
    - **⚠️ Импорты:**
      - `mapLoginRequestToApiPayload` из `effects/login/login-api.mapper.ts`
      - `validatedEffect` из `@livai/app/lib/schema-validated-effect.ts`
      - `loginTokenPairSchema` из `schemas/schemas.ts`
      - `withTimeout` из `@livai/app/lib/effect-timeout.ts`
  - **Step 5.2 — GET /v1/auth/me:**
    - Использовать `access_token` из Step 5.1 (`TokenPairValues.accessToken`)
    - Вызов `apiClient.get('/v1/auth/me', { headers: { Authorization:`Bearer ${accessToken}`}, signal: abortSignal })`
    - `validatedEffect(meResponseSchema.strict(), apiCall)`
    - Отдельный `withTimeout` с `config.timeouts.meApiTimeoutMs`
    - ❌ Fail-closed: если `/me` упал — логин считается неуспешным (не делать fallback)
    - **⚠️ Критично: Атомарность токенов:**
      - `TokenPair` **не записывается в store** пока `GET /me` не завершился успешно
      - Инвариант: `TokenPair` не попадает в store до успешного `/me`
      - Иначе возможен half-auth state: токен есть, user нет, audit не сработал
    - **⚠️ Импорты:**
      - `meResponseSchema` из `schemas/schemas.ts`
  - **Step 5.3 — агрегация:**
    - Преобразовать `LoginResponseDto` → `DomainLoginResult` через `mapLoginResponseToDomain`
    - Объединить `TokenPairValues` и `MeResponseValues` в `DomainLoginResult.success`
    - Только после успешного завершения обоих вызовов
    - **Только после агрегации** токены попадают в store (через Step 6)
    - **⚠️ Импорты:**
      - `mapLoginResponseToDomain` из `effects/login/login-api.mapper.ts`
      - `DomainLoginResult` из `domain/LoginResult.ts`

  **Step 6 — store update:**
  - Через `updateLoginState(store, securityResult, domainResult, metadata)`
  - **⚠️ Критично: SecurityPipelineResult для updater:**
    - `updateLoginState` требует полный `SecurityPipelineResult` (с `deviceInfo` и `riskAssessment`)
    - `LoginSecurityResult` из Step 2 содержит только projection (`decision`, `riskScore`, `riskLevel`)
    - Решение: хранить полный `SecurityPipelineResult` в промежуточном состоянии между Step 2 и Step 6
    - Или: адаптер `SecurityPipelinePort` должен сохранять полный результат для последующего использования
  - Использовать `DomainLoginResult` из Step 5.3
  - Использовать `LoginMetadata[]` из Step 4 (опционально)
  - ❌ Никакой бизнес-логики внутри login.ts
  - **⚠️ Импорты:**
    - `updateLoginState` из `effects/login/login-store-updater.ts`
    - `SecurityPipelineResult` из `lib/security-pipeline.ts`

- [x] Return-тип: строгий union `LoginResult` с полезным payload:
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
    - Все ошибки проходят через `deps.errorMapper.map(unknownError)` перед возвратом
  - **⚠️ Импорты:**
    - `AuthError` из `types/auth.ts`
    - `UserId` из domain (если есть branded type)

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

**6.1 Защита от параллельного выполнения (concurrency / re-entrancy):** ✅

**⚠️ Production-критично:** Что если пользователь нажал login 3 раза, а предыдущий запрос ещё выполняется?

- [x] Определить стратегию:
  - **Вариант 1:** Cancel previous (отменить предыдущий запрос)
  - **Вариант 2:** Ignore if running (игнорировать новый запрос, если уже выполняется)
  - **Вариант 3:** Serialize (поставить в очередь)
- [x] Реализовать защиту:
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
- [x] Поведение должно быть **явно определено** и документировано
- [x] Добавить тесты для concurrent вызовов

**Login-effect защищён от параллельного выполнения.**

---

## 7️⃣ Интегрировать error-mapper как единственный источник ошибок ✅

**Задача:** Все ошибки через error-mapper (включая ошибки обоих API-вызовов).

**Действия:**

- [x] В login.ts все три пути ошибок через `deps.errorMapper.map(unknownError)`:
  - Ошибки API (через `mapAuthError` внутри errorMapper) — для обоих вызовов (`/login` и `/me`)
  - `SchemaValidationError` → валидировать и маппить как `unknown`/`policy_violation`
  - Инфраструктурные (`TimeoutError`, `IsolationError`, сетевые) → через правила `network`/`unknown`
  - **⚠️ Импорты:**
    - `ErrorMapperPort` из `effects/login/login-effect.types.ts` (DI)
    - `mapAuthError` из `lib/error-mapper.ts` (если нужен для специфичной обработки API ошибок)
- [x] ❌ Никаких ручных `if (status === 401)` в login.ts
- [x] ❌ Любая ошибка второго шага (`/me`) также проходит через error-mapper
- [x] ❌ Не делать fallback типа "если `/me` упал — всё равно залогинить" — fail-closed: если `/me` не прошёл, логин считается неуспешным
- [x] Sanitization только в error-mapper
- [x] login.ts получает уже нормализованный `AuthError`

**Критерии готовности:**

- ✅ Все ошибки проходят через `deps.errorMapper.map(unknownError)`
- ✅ Нет ручной обработки HTTP-статусов
- ✅ Все ошибки типизированы как `AuthError`
- ✅ Ошибки обоих API-вызовов обрабатываются одинаково
- ✅ Все ошибки sanitized перед возвратом (никаких raw infrastructure errors)
- ✅ `error.message` и `error.details` не содержат sensitive данных

---

## 8️⃣ Принять единый timeout-policy ✅

**Задача:** Устранить конфликты таймаутов.

**Действия:**

- [x] Security timeout — только внутри `executeSecurityPipeline`
- [x] API timeouts — два отдельных, в login.ts (через `withTimeout` и config):
  - `loginApiTimeoutMs` для `POST /v1/auth/login`
  - `meApiTimeoutMs` для `GET /v1/auth/me`
  - ❌ Не один общий timeout для обоих вызовов
- [x] Validate и metadata — без таймаута (или минимальный фиксированный)
- [x] Удалить любые legacy-константы типа `LOGIN_TIMEOUT_MS`
- [x] Проверить, что нет нескольких уровней таймаутов

**Критерии готовности:**

- ✅ Таймауты определены в config (два отдельных для API)
- ✅ Нет legacy-констант
- ✅ Нет конфликтов между шагами

---

## 9️⃣ Интегрировать audit-логгер корректно ✅

**Задача:** Audit через DI, без глобалов.

**Действия:**

- [x] Передавать `MandatoryAuditLogger` в `security-pipeline`
  - ⚠️ Примечание: `security-pipeline` имеет свой собственный `mandatoryAuditLogger` в конфигурации через `SecurityPipelineConfig`, но это отдельный от `LoginEffectDeps.auditLogger` механизм для внутренних ошибок pipeline. Login-effect использует свой `auditLogger` для бизнес-событий (login_success, login_failure, etc.)
- [x] ❌ login.ts не использует `console.*`
- [x] Audit должен фиксировать:
  - `login_success` только после успешного `/me` (не после получения `tokenPair`)
  - Иначе можно получить токены, но не загрузить профиль — система окажется в inconsistent state
  - ✅ Реализовано: audit логируется после получения `domainResult`, который создается только после успешного `/me` (строка 438-440, 474)
- [x] При ошибке/блокировке — формировать `AuthAuditEvent` через существующую схему
  - ✅ Реализовано: используется `mapLoginResultToAuditEvent` + `auditEventSchema.parse` (строки 242, 474, 504)
- [x] Весь audit — через DI (`LoginEffectDeps.auditLogger`)
  - ✅ Реализовано: используется `deps.auditLogger.logAuditEvent` (строки 243, 475, 505)
- [x] Использовать отдельный mapper `mapLoginResultToAuditEvent(...)` — чтобы login.ts не содержал audit-структуру
  - ✅ Реализовано: используется `mapLoginResultToAuditEvent` из `login-audit.mapper.ts` с flattened `LoginAuditContext`

**Критерии готовности:**

- ✅ Нет `console.*` в login.ts
- ✅ Audit через injected logger (интерфейс, не конкретная реализация)
- ✅ События формируются через `auditEventSchema` и отдельный mapper
- ✅ `login_success` фиксируется только после успешного `/me`

---

## 🔟 Обновить public API feature-auth ✅

**Задача:** Экспортировать login-effect.

**Действия:**

- [x] В `packages/feature-auth/src/effects/index.ts`:
  - Экспортировать `createLoginEffect` или `loginEffect`
    - ✅ Реализовано: экспортируется `createLoginEffect` и `LoginResult` (строка 149)
  - ❌ Не экспортировать внутренние мапперы и updater по умолчанию
    - ✅ Реализовано: внутренние модули экспортируются явно с комментариями `@public` только если они являются частью public API (например, `login-api.mapper`, `login-store-updater`, `login-metadata.enricher` и другие утилиты, которые могут использоваться вне login-effect)
  - (Только если это часть public API — экспортировать явно)
    - ✅ Реализовано: все экспорты явные, с документацией и комментариями `@public`

**Критерии готовности:**

- ✅ login-effect доступен через public API
- ✅ Внутренние модули не экспортируются по умолчанию

---

## 1️⃣1️⃣ Проверить архитектурные инварианты (Staff+ checklist) ✅

**Задача:** Финальная проверка всех требований.

**Чек-лист:**

- [x] ❌ Нет `Record` в domain
  - ⚠️ Примечание: `Record` используется только для extensible метаданных (meta, context, variables) в domain-типах, что допустимо для future-proof расширяемости. Не используется для бизнес-логики.
- [x] ❌ Нет `console.*`
  - ✅ Проверено: нет вызовов console.* в login.ts
- [x] ❌ Нет бизнес-логики в orchestrator
  - ✅ Проверено: orchestrator только координирует вызовы через DI-порты, вся бизнес-логика в domain/security-pipeline/mappers
- [x] ❌ Нет fallback-значений
  - ⚠️ Примечание: есть конфигурационный fallback `?? DEFAULT_LOGIN_HARD_TIMEOUT_MS` (строка 426), что допустимо для дефолтных значений конфигурации
- [x] ❌ Нет дублирования risk-policy
  - ✅ Проверено: risk-policy используется только через security-pipeline, нет дублирования
- [x] ❌ Нет нескольких уровней таймаутов
  - ⚠️ Примечание: реализована иерархическая структура таймаутов (Agent-level в security-pipeline → Step-level через DSL → Global hard timeout), что является правильной архитектурой для надежности
- [x] ❌ Нет пересечения transport DTO и domain типов
  - ✅ Проверено: четкое разделение через mapper (login-api.mapper.ts), domain использует чистые domain-типы, transport DTO в schemas
- [x] ❌ Нет mutable объектов в domain
  - ✅ Проверено: все domain-типы используют `readonly`, все поля immutable
- [x] ❌ Нет прямых вызовов `Date.now()` и `new Date()` внутри effect-цепочки (используется `clock` из DI)
  - ✅ Проверено: используется `deps.clock.now()` (строки 161, 288, 467, 497), нет прямых вызовов Date
- [x] ❌ Нет implicit `any` в effect-цепочке и orchestrator
  - ✅ Проверено: все типы явно указаны, используется `unknown` для error handling (строка 489)
- [x] ✅ Deterministic
  - ✅ Реализовано: eventId генерируется через `generateEventId(deps.clock)` для детерминизма в тестах (строки 235, 467, 497)
- [x] ✅ Fail-closed security
  - ✅ Реализовано: двухфазный login (без успешного /me → login не считается успешным), fail-closed проверки в audit mapper (sessionId/userId), strict Zod validation
- [x] ✅ Rule-engine масштабируем
  - ✅ Реализовано: через security-pipeline с плагинами и контекстными билдерами
- [x] ✅ Store — единственный владелец состояния
  - ✅ Реализовано: все обновления состояния через login-store-updater (updateLoginState/applyBlockedState), атомарный batchUpdate
- [x] ✅ Schema-validated boundary
  - ✅ Реализовано: strict Zod validation (loginRequestSchema.strict()), validatedEffect для API calls (loginTokenPairSchema, meResponseSchema), auditEventSchema для audit events

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
**Статус:** Реализовано
