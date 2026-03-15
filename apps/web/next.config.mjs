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

  // Конфигурация изображений
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
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