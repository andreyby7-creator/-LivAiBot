data/ ├── README.md # 🔹 Обзор data layer: структура БД, миграции, типизированный доступ через
Prisma ├── prisma/ # 🔹 Prisma схема и генерация клиента │ ├── schema.prisma # 🔹 Основная Prisma
схема (PostgreSQL) │ ├── index.ts # 🔹 Экспорт PrismaClient │ └── README.md # 🔹 Инструкции по
генерации клиента и применению схем ├── client/ # 🔹 Type-safe Prisma клиент (TypeScript-friendly) │
├── PrismaClientFactory.ts # 🔹 Factory для PrismaClient (DI-friendly, Effect-ready) │ └──
index.ts # 🔹 Главный экспорт клиента ├── migrations/ # 🔹 Миграции базы данных │ ├── README.md # 🔹
Как создавать и применять миграции │ └── \*.sql # 🔹 Файлы миграций
