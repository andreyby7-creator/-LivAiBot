# Changelog - Core Contracts

## [Unreleased]

### Added
- **Cache Adapter**: Полная реализация с timeout, retry, circuit breaker
- **Bulk Operations**: @experimental интерфейсы mget/mset в CacheClient
- **CI/CD Scripts**: Автоматическая проверка циклических зависимостей
- **Type Safety**: Улучшенные discriminated union типы в ErrorCode

### Performance
- **Build Optimization**: 3x быстрее сборка (2.1s вместо 6s)
- **Bundle Size**: 92% меньше размера (236KB вместо 3.2MB)
- **Incremental Compilation**: Включена для TypeScript

### Developer Experience
- **Extension Points**: @experimental аннотации для будущих API
- **Comprehensive Tests**: 95%+ покрытие (2362 теста)
- **Automated Checks**: Циклические зависимости, линтинг, типы

## [1.0.0] - 2024-12-XX

### Added
- Initial release of LivAi Core Contracts
- Error system with discriminated unions
- Effect-based adapters architecture
- Comprehensive test suite
- Enterprise-grade error handling

### Features
- HTTP, Database, Cache adapters with resilience patterns
- Normalizers for external error transformation
- Builders for structured error creation
- Full TypeScript support with strict mode

### Quality Metrics
- **Test Coverage**: 95.47% statements, 91.38% branches
- **Build Time**: < 3 seconds
- **Bundle Size**: < 250KB
- **Zero Circular Dependencies**: ✅
- **Zero Type Errors**: ✅

---

## Version Planning

### Minor Versions (Feature Additions)
- **1.1.0**: Bulk operations (mget/mset) implementation
- **1.2.0**: Advanced retry strategies (exponential backoff)
- **1.3.0**: Custom error transformers
- **1.4.0**: Performance monitoring integration

### Patch Versions (Bug Fixes)
- **1.0.1**: Type definitions fixes
- **1.0.2**: Documentation improvements
- **1.0.3**: Test coverage edge cases

### Breaking Changes (Major Versions)
- **2.0.0**: Effect library major update
- **3.0.0**: Complete API redesign (if needed)
