'use client';

import { useTranslations } from 'next-intl';
import type { JSX } from 'react';
import { useEffect, useState } from 'react';

import type { Locale } from '../../../../i18n/routing';

/**
 * Props для компонента DashboardPage
 */
type DashboardPageProps = {
  readonly params: {
    readonly locale: Locale;
  };
};

/**
 * @file Страница Dashboard - основной интерфейс приложения
 *
 * TODO: Реализовать виджеты dashboard:
 * - Карточки статистики (пользователи, доход, активность)
 * - Графики и диаграммы (тренды дохода, рост пользователей)
 * - Лента недавней активности
 * - Панель быстрых действий
 * - Индикаторы статуса системы
 *
 * TODO: Добавить интеграцию данных в реальном времени
 * TODO: Реализовать адаптивный дизайн для мобильных/планшетов
 * TODO: Добавить навигацию клавиатурой и поддержку скринридеров
 */
// Количество skeleton элементов для загрузки
const SKELETON_COUNT = 6;

export default function DashboardPage({
  params,
}: DashboardPageProps): JSX.Element {
  // Гарантируем правильную типизацию locale для будущего использования (например, условный рендеринг)
  const { locale } = params;
  const t = useTranslations<'dashboard'>();

  // TODO: Заменить на реальную загрузку данных виджетов
  const [widgetsLoading, setWidgetsLoading] = useState(true);

  // TODO: Симуляция загрузки виджетов (заменить на реальный API call)
  useEffect(() => {
    const timer = setTimeout(() => {
      setWidgetsLoading(false);
    }, 1000); // Симуляция загрузки 1 секунды

    return (): void => {
      clearTimeout(timer);
    };
  }, []);

  // TODO: Skeleton компонент для загрузки виджетов
  const renderSkeleton = (): JSX.Element => (
    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
      {Array.from({ length: SKELETON_COUNT }, (_, index) => index + 1).map((id) => (
        <div
          key={`dashboard-skeleton-${id}`}
          className='bg-white rounded-lg shadow p-6 animate-pulse'
        >
          <div className='h-4 bg-gray-200 rounded w-3/4 mb-3' />
          <div className='h-8 bg-gray-200 rounded w-1/2 mb-4' />
          <div className='space-y-2'>
            <div className='h-3 bg-gray-200 rounded' />
            <div className='h-3 bg-gray-200 rounded w-5/6' />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <main
      className='p-6 font-sans min-h-screen bg-gray-50'
      data-locale={locale}
      role='main'
      aria-label={t('dashboard.title')}
    >
      <div className='w-full max-w-6xl mx-auto'>
        <h1
          className='text-2xl font-bold'
          data-testid='dashboard-title'
        >
          {t('dashboard.title')}
        </h1>

        <p
          className='mt-3 text-gray-500'
          data-testid='dashboard-description'
        >
          {t('dashboard.description')}
        </p>

        {/* TODO: Виджеты Dashboard - графики, метрики, недавняя активность */}
        <section
          className='mt-6'
          aria-label='Dashboard widgets'
          role='region'
          aria-live='polite'
          aria-busy={widgetsLoading}
        >
          {widgetsLoading
            ? (
              renderSkeleton()
            )
            : (
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
                <div className='bg-white rounded-lg shadow p-6'>
                  <h3 className='text-lg font-semibold text-gray-900 mb-2'>Пример виджета</h3>
                  <p className='text-gray-600'>Здесь будет содержимое виджета</p>
                </div>
              </div>
            )}
        </section>
      </div>
    </main>
  );
}
