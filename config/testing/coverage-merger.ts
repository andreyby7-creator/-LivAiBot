/**
 * @file Объединение и анализ отчетов о покрытии из разных тестовых инструментов
 * С поддержкой Vitest, Playwright и pytest-cov с полной типизацией
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import { coverage as coverageConfig, env, paths } from './shared-config';

/** Типы инструментов покрытия */
type CoverageTool = 'vitest' | 'playwright' | 'python';

/** Типы для обозначения неудач в проверке покрытия */
type FailureType = CoverageTool | 'total';

/** Базовый формат coverage отчета */
interface CoverageReport {
  [key: string]: unknown;
}

/** Формат отчета Vitest */
interface VitestCoverageReport extends CoverageReport {
  total?: {
    percent?: number;
    pct?: number;
  };
}

/** Формат отчета Playwright */
interface PlaywrightCoverageReport extends CoverageReport {
  coverage?: {
    percent?: number;
  };
}

/** Формат отчета Python */
interface PythonCoverageReport extends CoverageReport {
  totals?: {
    percent_covered?: number;
  };
}

/** Структура объединенного отчета о покрытии */
interface MergedCoverageReport {
  timestamp: string;
  environment: string;
  isCI: boolean;
  coverage: {
    total: number;
    breakdown: Record<CoverageTool, number>;
    weights: Record<CoverageTool, number>;
  };
  reports: {
    vitest: unknown;
    playwright: unknown;
    python: unknown;
  };
  metadata: {
    tools: CoverageTool[];
    generatedAt: string;
  };
}

/** Читает JSON отчет о покрытии с типизацией */
async function readCoverageReport<T extends CoverageReport>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content) as T;
  } catch (error) {
    if (env.isVerbose) {
      console.warn(`⚠️  Could not read coverage report ${filePath}:`, (error as Error).message);
    }
    return null;
  }
}

/** Вычисляет процент покрытия из разных форматов отчетов */
function calculateCoveragePercent(
  report: VitestCoverageReport | PlaywrightCoverageReport | PythonCoverageReport | null,
  type: CoverageTool,
): number {
  if (report == null || typeof report !== 'object') return 0;

  switch (type) {
    case 'vitest': {
      const vitestReport = report as VitestCoverageReport;
      return vitestReport.total?.percent ?? vitestReport.total?.pct ?? 0;
    }
    case 'playwright': {
      const playwrightReport = report as PlaywrightCoverageReport;
      return playwrightReport.coverage?.percent ?? 0;
    }
    case 'python': {
      const pythonReport = report as PythonCoverageReport;
      return pythonReport.totals?.percent_covered ?? 0;
    }
    default:
      return 0;
  }
}

/** Объединяет отчеты о покрытии */
export async function mergeCoverageReports(): Promise<MergedCoverageReport | null> {
  if (env.isVerbose) {
    console.log('📊 Merging coverage reports...');
  }

  try {
    // Читаем все доступные отчеты
    const vitestReport = await readCoverageReport<VitestCoverageReport>(
      path.join(paths.coverage.js, 'coverage-final.json'),
    );
    const playwrightReport = await readCoverageReport<PlaywrightCoverageReport>(
      path.join(paths.coverage.js, 'playwright-coverage.json'),
    );
    const pythonReport = await readCoverageReport<PythonCoverageReport>(
      path.join(paths.coverage.python, 'coverage.json'),
    );

    // Вычисляем покрытие по типам
    const coverage: Record<CoverageTool, number> = {
      vitest: calculateCoveragePercent(vitestReport, 'vitest'),
      playwright: calculateCoveragePercent(playwrightReport, 'playwright'),
      python: calculateCoveragePercent(pythonReport, 'python'),
    };

    // Вычисляем общее покрытие с фиксированными весами
    const availableCoverage = Object.entries(coverage).filter(([, percent]) => percent > 0);
    const weights = { vitest: 0.4, playwright: 0.3, python: 0.3 };
    let totalCoverage = 0;

    // Применяем веса к доступным источникам
    for (const [tool, percent] of availableCoverage) {
      const weight = weights[tool as keyof typeof weights] || 0;
      totalCoverage += percent * weight;
    }

    // Нормализуем, если не все источники присутствуют
    const totalWeight = availableCoverage.length > 0
      ? availableCoverage.reduce((sum, [tool]) => {
        return sum + (weights[tool as keyof typeof weights] || 0);
      }, 0)
      : 0;

    if (totalWeight > 0) {
      totalCoverage /= totalWeight;
    }

    // Создаем объединенный отчет
    const now = new Date().toISOString();
    const mergedReport = {
      timestamp: now,
      environment: env.testEnv,
      isCI: env.isCI,
      coverage: {
        total: Math.round(totalCoverage * 100) / 100,
        breakdown: coverage,
        weights,
      },
      reports: {
        vitest: vitestReport,
        playwright: playwrightReport,
        python: pythonReport,
      },
      metadata: {
        tools: ['vitest', 'playwright', 'python'] as CoverageTool[],
        generatedAt: now,
      },
    };

    // Сохраняем объединенный отчет
    const outputPath = path.join(paths.coverage.merged, 'merged-coverage.json');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(mergedReport, null, 2));

    // Создаем простой текстовый отчет
    const textReport = [
      `Coverage Report - ${new Date().toLocaleString()}`,
      '═══════════════════════════════════════════════',
      '',
      `Total Coverage: ${mergedReport.coverage.total.toFixed(1)}%`,
      '',
      'Breakdown:',
      `• JavaScript (Vitest):    ${coverage.vitest.toFixed(1)}%`,
      `• E2E (Playwright):       ${coverage.playwright.toFixed(1)}%`,
      `• Python (pytest-cov):    ${coverage.python.toFixed(1)}%`,
      '',
      `Environment: ${env.testEnv}`,
      `CI: ${env.isCI ? 'Yes' : 'No'}`,
      `Generated: ${mergedReport.metadata.generatedAt}`,
    ].join('\n');

    const textPath = path.join(paths.coverage.merged, 'coverage-summary.txt');
    await fs.writeFile(textPath, textReport);

    if (env.isVerbose) {
      console.log(`✅ Coverage reports merged successfully!`);
      console.log(`   Total coverage: ${mergedReport.coverage.total.toFixed(1)}%`);
      console.log(`   Report saved to: ${outputPath}`);
    }

    return mergedReport;
  } catch (error) {
    console.error('❌ Failed to merge coverage reports:', error);
    return null;
  }
}

/** Проверяет пороги покрытия */
export function checkCoverageThresholds(
  mergedReport: MergedCoverageReport,
  thresholds = coverageConfig.vitest.thresholds,
): {
  passed: boolean;
  failures: Array<{ type: FailureType; actual: number; required: number; }>;
  summary: { total: number; passed: boolean; failures: number; };
} {
  const configThresholds = thresholds;
  const threshold = configThresholds.lines;

  // Проверяем общее покрытие
  const totalFailure = mergedReport.coverage.total < threshold
    ? [{
      type: 'total' as const,
      actual: mergedReport.coverage.total,
      required: threshold,
    }]
    : [];

  // Проверяем покрытие по инструментам
  const toolFailures = Object.entries(mergedReport.coverage.breakdown)
    .filter(([, percent]) => percent < threshold)
    .map(([tool, percent]) => ({
      type: tool as CoverageTool,
      actual: percent,
      required: threshold,
    }));

  const allFailures = [...totalFailure, ...toolFailures];
  const passed = totalFailure.length === 0 && toolFailures.length === 0;

  return {
    passed,
    failures: allFailures,
    summary: {
      total: mergedReport.coverage.total,
      passed,
      failures: allFailures.length,
    },
  };
}
