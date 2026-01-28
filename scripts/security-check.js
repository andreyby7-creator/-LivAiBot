#!/usr/bin/env node

/**
 * Проверка безопасности зависимостей через Snyk
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

function runSnykCheck() {
  console.log('🔒 Запуск проверки безопасности зависимостей через Snyk...\n');

  try {
    // Проверяем установлен ли Snyk
    try {
      execSync('snyk --version', { stdio: 'pipe' });
    } catch (error) {
      console.error('❌ Snyk CLI не установлен!');
      console.log('');
      console.log('💡 Установка Snyk:');
      console.log('   npm install -g snyk');
      console.log('   # или');
      console.log('   curl -sL https://snyk.io/install.sh | bash');
      console.log('');
      console.log('🔐 Авторизация:');
      console.log('   snyk auth');
      console.log('');
      console.log('📚 Подробнее: https://docs.snyk.io/snyk-cli');
      process.exit(1);
    }

    console.log('✅ Snyk CLI найден, запускаем сканирование...\n');

    // Запускаем Snyk test для проверки уязвимостей
    try {
      const snykOutput = execSync('snyk test --file=package.json --package-manager=pnpm --json', {
        encoding: 'utf8',
        stdio: 'pipe',
      });

      const results = JSON.parse(snykOutput);

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
          const textOutput = execSync('snyk test', { encoding: 'utf8' });
          console.log(textOutput);
        } catch (textError) {
          console.error('❌ Не удалось получить результаты от Snyk');
          console.error('Убедитесь что Snyk правильно установлен и авторизован');
          process.exit(1);
        }
      }
    }
  } catch (error) {
    console.error('❌ Ошибка проверки безопасности:', error.message);
    process.exit(1);
  }
}

runSnykCheck();
