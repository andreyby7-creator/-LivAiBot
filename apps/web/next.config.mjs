import createNextIntlPlugin from 'next-intl/plugin';

// Настройка next-intl плагина
const withNextIntl = createNextIntlPlugin('./next-intl.config.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Конфигурация вывода для Docker развертывания
  output: 'standalone',

  // Строгий режим TypeScript
  typescript: {
    tsconfigPath: './tsconfig.build.json',
  },

  // Оптимизация Turbopack: транслируем только React/TSX пакеты
  // ⚠️ Важно: не включать все workspace пакеты - это замедляет сборку
  // Транслируем только UI пакеты, которые содержат React компоненты
  transpilePackages: [
    '@livai/ui-core',      // UI компоненты
    '@livai/ui-features',  // UI компоненты
    '@livai/ui-shared',    // UI утилиты
    '@livai/app',          // Может содержать React компоненты
  ],

  // Конфигурация изображений
  // ⚠️ Безопасность: явно указываем разрешенные домены вместо '**'
  // Это предотвращает SSRF атаки и улучшает производительность
  images: {
    remotePatterns: [
      // API домен для изображений с бэкенда (аватары, загруженные файлы)
      // Извлекаем hostname из NEXT_PUBLIC_API_URL
      ...(process.env.NEXT_PUBLIC_API_URL
        ? [
            {
              protocol: 'https',
              hostname: new URL(process.env.NEXT_PUBLIC_API_URL).hostname,
            },
          ]
        : []),
      // OAuth провайдеры для аватаров пользователей
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com', // Google OAuth avatars
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com', // GitHub OAuth avatars
      },
      // TODO: Добавьте ваш CDN домен здесь, если используется
      // {
      //   protocol: 'https',
      //   hostname: 'cdn.example.com',
      // },
    ],
    // dangerouslyAllowSVG: true, // Убрано для совместимости с Next.js 16
  },

  // Заголовки для безопасности и производительности
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },

  // Перенаправления (отключены для E2E тестов)
  // async redirects() {
  //   return [
  //     {
  //       source: '/',
  //       destination: '/dashboard',
  //       permanent: true, // Постоянное перенаправление для SEO
  //     },
  //   ];
  // },
};

export default withNextIntl(nextConfig);
