core-contracts/ 
│   └── src/ 
│   └── fn/ # 🔹 Functional Types & Optics Core (Pure FP) 
│   ├── index.ts # 🎯
Единственная публичная точка входа 
│   ├── types/ # 🔹 Чистые типы (zero runtime) 
│   ├── constructors/ # 🔹
Создание типов (pure) 
│   ├── combinators/ # 🔹 Композиция и алгебра 
│   ├── transformers/ # 🔹 Functor /
Profunctor операции 
│   ├── laws/ # 🔹 FP-законы (опционально) 
│   ├── utils/ # 🔹 Вспомогательные
pure-хелперы │ 
│   ├── pipe.ts # 🔧 Левая композиция функций (data-first) │ 
│   ├── compose.ts # 🔧 Правая
композиция функций (math-first) │ 
│   └── index.ts # 📦 Экспорт утилит utils 
│   └── README.md # 📘 Контракт и
правила пакета
