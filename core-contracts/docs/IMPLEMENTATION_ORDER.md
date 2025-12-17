# Порядок реализации модулей Core Contracts

## Оптимальная последовательность (с учетом зависимостей)

### 1. `io/effect/` — Базовый фундамент
**Почему первым:**
- Не зависит от других модулей core-contracts
- Нужен для: time, config, context, resilience, rate-limiting, health, logging
- Унифицирует использование Effect (сейчас errors импортирует напрямую из "effect")

**Зависимости:** только библиотека `effect`

---

### 2. `time/` — Простой модуль
**Зависимости:** io/effect (Effect.Clock)

---

### 3. `config/` — Простой модуль
**Зависимости:** io/effect

---

### 4. `context/` — Базовый для correlation/tenant
**Зависимости:** io/effect (Effect.Context)

---

### 5. `logging/` — Сложный модуль
**Зависимости:** errors (уже реализован), context, time

---

### 6. `resilience/` — Устойчивость
**Зависимости:** io/effect, time

---

### 7. `rate-limiting/` — Rate limiting
**Зависимости:** io/effect, time

---

### 8. `health/` — Health checks
**Зависимости:** io/effect

---

### 9. `io/schema/` — Валидация
**Зависимости:** только библиотека `@effect/schema`

---

### 10. `fp/` — FP утилиты
**Зависимости:** может использовать io/effect

---

### 11. `domain/` — Domain слой
**Зависимости:** io, fp, errors

---

### 12. `targets/` — Runtime bindings
**Зависимости:** все модули

---

## Критический путь

**io/effect → time → config → context → logging → resilience → rate-limiting → health**

Этот путь обеспечивает максимальную скорость разработки без необходимости переделывать код из-за отсутствующих зависимостей.
