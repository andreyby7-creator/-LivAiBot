#!/usr/bin/env node

/**
 * Проверка безопасности зависимостей через Snyk или pnpm audit
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const reportsDir = path.resolve('reports');
const securityReportPath = path.join(reportsDir, 'security-report.json');

// Создаем директорию reports если её нет
try {
  fs.accessSync(reportsDir, fs.constants.F_OK);
} catch {
  fs.mkdirSync(reportsDir, { recursive: true });
}

function runPnpmAudit() {
  console.log('🔍 Запуск проверки безопасности через pnpm audit...\n');

  try {
    const auditOutput = execSync('pnpm audit --audit-level=moderate --json', {
      encoding: 'utf8',
      stdio: 'pipe',
    });

    const auditResults = JSON.parse(auditOutput);

    console.log('📊 РЕЗУЛЬТАТЫ PNPM AUDIT ПРОВЕРКИ');
    console.log('='.repeat(50));

    const vulnerabilities = auditResults.metadata?.vulnerabilities || {};
    const totalDeps = auditResults.metadata?.totalDependencies || 0;

    console.log(`Общее количество зависимостей: ${totalDeps}`);
    console.log(
      `Найдено уязвимостей: ${Object.values(vulnerabilities).reduce((a, b) => a + b, 0)}`,
    );
    console.log(`  - Высокий риск: ${vulnerabilities.high || 0}`);
    console.log(`  - Средний риск: ${vulnerabilities.moderate || 0}`);
    console.log(`  - Низкий риск: ${vulnerabilities.low || 0}`);
    console.log(`  - Информационный: ${vulnerabilities.info || 0}`);
    console.log('');

    // Сохраняем отчет
    const report = {
      timestamp: new Date().toISOString(),
      tool: 'pnpm audit',
      summary: {
        totalDependencies: totalDeps,
        vulnerabilities: Object.values(vulnerabilities).reduce((a, b) => a + b, 0),
        high: vulnerabilities.high || 0,
        medium: vulnerabilities.moderate || 0,
        low: vulnerabilities.low || 0,
        info: vulnerabilities.info || 0,
      },
      vulnerabilities: auditResults.metadata?.vulnerabilities || {},
      rawResults: auditResults,
    };

    fs.writeFileSync(securityReportPath, JSON.stringify(report, null, 2));

    const totalVulns = Object.values(vulnerabilities).reduce((a, b) => a + b, 0);
    if (totalVulns > 0) {
      console.log('🚨 ОБНАРУЖЕННЫЕ УЯЗВИМОСТИ:');
      console.log('   Используйте: pnpm audit --fix (для автоматического исправления)');
      console.log('');

      console.log('❌ ПРОВЕРКА ЗАВЕРШЕНА С ПРОБЛЕМАМИ');
      console.log(`📄 Отчет сохранен: ${securityReportPath}`);
      process.exit(1);
    } else {
      console.log('✅ УЯЗВИМОСТЕЙ НЕ ОБНАРУЖЕНО');
      console.log(`📄 Отчет сохранен: ${securityReportPath}`);
      console.log('');
      console.log('🎉 ПРОЕКТ БЕЗОПАСЕН!');
    }
  } catch (auditError) {
    console.error('❌ Ошибка выполнения pnpm audit');
    console.error(auditError.message);
    process.exit(1);
  }
}

function runSnykScan() {
  try {
    // Используем --all-projects для сканирования всего monorepo
    const snykOutput = execSync('npx snyk test --all-projects --json', {
      encoding: 'utf8',
      stdio: 'pipe',
    });

    const allResults = JSON.parse(snykOutput);

    // Суммируем результаты всех проектов
    let totalDependencies = 0;
    let totalVulnerabilities = [];
    let totalHigh = 0;
    let totalMedium = 0;
    let totalLow = 0;

    allResults.forEach((projectResult) => {
      totalDependencies += projectResult.dependencyCount ?? 0;

      if (projectResult.vulnerabilities && projectResult.vulnerabilities.length > 0) {
        totalVulnerabilities.push(...projectResult.vulnerabilities);

        // Считаем уязвимости по severity
        projectResult.vulnerabilities.forEach((vuln) => {
          const severity = vuln.severity?.toLowerCase();
          if (severity === 'high') totalHigh++;
          else if (severity === 'medium') totalMedium++;
          else if (severity === 'low') totalLow++;
        });
      }
    });

    // Создаем суммарный результат
    const results = {
      dependencyCount: totalDependencies,
      vulnerabilities: totalVulnerabilities,
      summary: {
        totalUniqueVulns: totalVulnerabilities.length,
        high: totalHigh,
        medium: totalMedium,
        low: totalLow,
      },
    };

    // Обрабатываем результаты
    const vulnerabilities = results.vulnerabilities || [];
    const summary = results.summary || {};

    console.log('📊 РЕЗУЛЬТАТЫ SNYK ПРОВЕРКИ');
    console.log('='.repeat(50));
    console.log(`Общее количество зависимостей: ${results.dependencyCount || 0}`);
    console.log(`Найдено уязвимостей: ${summary.totalUniqueVulns || 0}`);
    console.log(`  - Высокий риск: ${summary.high || 0}`);
    console.log(`  - Средний риск: ${summary.medium || 0}`);
    console.log(`  - Низкий риск: ${summary.low || 0}`);
    console.log('');

    // Сохраняем полный отчет
    const report = {
      timestamp: new Date().toISOString(),
      tool: 'Snyk',
      summary: {
        totalDependencies: results.dependencyCount || 0,
        vulnerabilities: summary.totalUniqueVulns || 0,
        high: summary.high || 0,
        medium: summary.medium || 0,
        low: summary.low || 0,
      },
      vulnerabilities: vulnerabilities,
      rawResults: results,
    };

    fs.writeFileSync(securityReportPath, JSON.stringify(report, null, 2));

    if (vulnerabilities.length > 0) {
      console.log('🚨 ОБНАРУЖЕННЫЕ УЯЗВИМОСТИ:');
      console.log('');

      vulnerabilities.slice(0, 10).forEach((vuln, index) => {
        console.log(`${index + 1}. ${vuln.title}`);
        console.log(`   Пакет: ${vuln.packageName}@${vuln.version}`);
        console.log(`   Серьезность: ${vuln.severity.toUpperCase()}`);
        console.log(`   CVE: ${vuln.identifiers?.CVE?.join(', ') || 'N/A'}`);
        console.log(`   CVSS Score: ${vuln.cvssScore || 'N/A'}`);
        console.log(`   Путь: ${vuln.from?.join(' > ') || 'N/A'}`);
        console.log('');
      });

      if (vulnerabilities.length > 10) {
        console.log(`... и еще ${vulnerabilities.length - 10} уязвимостей`);
        console.log('');
      }

      console.log('💡 РЕКОМЕНДАЦИИ:');
      console.log('   • Запустите: snyk wizard');
      console.log('   • Обновите уязвимые пакеты');
      console.log('   • Проверьте: snyk monitor');
      console.log('');

      console.log('❌ ПРОВЕРКА ЗАВЕРШЕНА С ПРОБЛЕМАМИ');
      console.log(`📄 Подробный отчет: ${securityReportPath}`);
      process.exit(1);
    } else {
      console.log('✅ УЯЗВИМОСТЕЙ НЕ ОБНАРУЖЕНО');
      console.log(`📄 Отчет сохранен: ${securityReportPath}`);
      console.log('');
      console.log('🎉 ПРОЕКТ БЕЗОПАСЕН!');
    }
  } catch (snykError) {
    // Snyk вернул ошибку (обычно означает найденные уязвимости)
    try {
      const errorOutput = snykError.stdout || snykError.stderr;
      if (errorOutput) {
        const results = JSON.parse(errorOutput);
        const vulnerabilities = results.vulnerabilities || [];
        const summary = results.summary || {};

        console.log('📊 РЕЗУЛЬТАТЫ SNYK ПРОВЕРКИ');
        console.log('='.repeat(50));
        console.log(`Общее количество зависимостей: ${results.dependencyCount || 0}`);
        console.log(`Найдено уязвимостей: ${summary.totalUniqueVulns || 0}`);
        console.log(`  - Высокий риск: ${summary.high || 0}`);
        console.log(`  - Средний риск: ${summary.medium || 0}`);
        console.log(`  - Низкий риск: ${summary.low || 0}`);
        console.log('');

        // Сохраняем отчет
        const report = {
          timestamp: new Date().toISOString(),
          tool: 'Snyk',
          summary: {
            totalDependencies: results.dependencyCount || 0,
            vulnerabilities: summary.totalUniqueVulns || 0,
            high: summary.high || 0,
            medium: summary.medium || 0,
            low: summary.low || 0,
          },
          vulnerabilities: vulnerabilities,
          rawResults: results,
        };

        fs.writeFileSync(securityReportPath, JSON.stringify(report, null, 2));

        if (vulnerabilities.length > 0) {
          console.log('🚨 ОБНАРУЖЕННЫЕ УЯЗВИМОСТИ:');
          console.log('');

          vulnerabilities.slice(0, 5).forEach((vuln, index) => {
            console.log(`${index + 1}. ${vuln.title}`);
            console.log(`   Пакет: ${vuln.packageName}@${vuln.version}`);
            console.log(`   Серьезность: ${vuln.severity.toUpperCase()}`);
            console.log(`   CVE: ${vuln.identifiers?.CVE?.join(', ') || 'N/A'}`);
            console.log('');
          });

          if (vulnerabilities.length > 5) {
            console.log(`... и еще ${vulnerabilities.length - 5} уязвимостей`);
            console.log('');
          }

          console.log('💡 РЕКОМЕНДАЦИИ:');
          console.log('   • Запустите: snyk wizard (для автоматического исправления)');
          console.log('   • Обновите уязвимые пакеты');
          console.log('   • Настройте: snyk monitor (для непрерывного мониторинга)');
          console.log('');

          console.log('❌ ПРОВЕРКА ЗАВЕРШЕНА С ПРОБЛЕМАМИ');
          console.log(`📄 Подробный отчет: ${securityReportPath}`);
          process.exit(1);
        }
      }
    } catch (parseError) {
      // Не удалось распарсить JSON, выводим текстовую версию
      console.log('📊 РЕЗУЛЬТАТЫ SNYK ПРОВЕРКИ (текстовый вывод):');
      console.log('='.repeat(50));

      try {
        const textOutput = execSync('npx snyk test --all-projects', { encoding: 'utf8' });
        console.log(textOutput);
      } catch (textError) {
        console.error('❌ Не удалось получить результаты от Snyk');
        console.error('Убедитесь что Snyk правильно установлен и авторизован');
        process.exit(1);
      }
    }
  }
}

function runSecurityCheck() {
  console.log('🔒 Запуск проверки безопасности зависимостей...\n');

  // Проверяем переменную окружения для выбора инструмента
  const useSnyk = process.env.USE_SNYK !== 'false'; // По умолчанию используем Snyk если доступен

  try {
    // Проверяем установлен и авторизован ли Snyk
    let snykAvailable = false;
    if (useSnyk) {
      try {
        execSync('npx snyk --version', { stdio: 'pipe' });
        // Проверяем авторизацию
        try {
          execSync('npx snyk whoami --experimental', { stdio: 'pipe' });
          snykAvailable = true;
        } catch (authError) {
          console.log('⚠️  Snyk установлен, но не авторизован');
          console.log('🔄 Используем pnpm audit как альтернативу...');
          console.log('');
        }
      } catch (error) {
        console.log('⚠️  Snyk CLI не установлен');
        console.log('💡 Установите: pnpm add -D -w snyk');
        console.log('🔄 Используем pnpm audit как альтернативу...');
        console.log('');
      }
    }

    if (snykAvailable && useSnyk) {
      console.log('✅ Snyk CLI найден и авторизован, запускаем сканирование...\n');
      runSnykScan();
    } else {
      console.log('🔍 Используем pnpm audit для проверки безопасности...\n');
      runPnpmAudit();
    }
  } catch (error) {
    console.error('❌ Ошибка проверки безопасности:', error.message);
    process.exit(1);
  }
}

runSecurityCheck();
