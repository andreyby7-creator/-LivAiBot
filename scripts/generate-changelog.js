#!/usr/bin/env node

/**
 * Генерация CHANGELOG.md из git коммитов
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const reportsDir = path.resolve('reports');
const changelogPath = path.join(reportsDir, 'CHANGELOG.md');

// Создаем директорию reports если её нет
try {
  fs.accessSync(reportsDir, fs.constants.F_OK);
} catch {
  fs.mkdirSync(reportsDir, { recursive: true });
}

function generateChangelog() {
  try {
    console.log('📝 Генерация CHANGELOG.md...');

    // Получаем последний тег
    let lastTag = 'HEAD~10'; // По умолчанию последние 10 коммитов
    try {
      const tags = execSync('git tag --sort=-version:refname', { encoding: 'utf8' }).trim().split(
        '\n',
      );
      if (tags.length > 0 && tags[0]) {
        lastTag = tags[0];
      }
    } catch (error) {
      console.log('⚠️  Не найдены git теги, используем последние коммиты');
    }

    // Получаем коммиты с момента последнего релиза
    const gitLog = execSync(`git log ${lastTag}..HEAD --oneline --pretty=format:"%h %s"`, {
      encoding: 'utf8',
    }).trim();

    const commits = gitLog.split('\n').filter((line) => line.trim());

    // Группируем коммиты по типам
    const categories = {
      '🚀 Features': [],
      '🐛 Bug Fixes': [],
      '📚 Documentation': [],
      '🔧 Maintenance': [],
      '⚡ Performance': [],
      '🧪 Testing': [],
      '🔒 Security': [],
      '🏗️ Build/CI': [],
      '📦 Dependencies': [],
    };

    commits.forEach((commit) => {
      const [hash, ...messageParts] = commit.split(' ');
      const message = messageParts.join(' ');

      // Определяем тип коммита по префиксу или ключевым словам
      if (message.includes('feat:') || message.includes('feature:') || message.includes('add:')) {
        categories['🚀 Features'].push({
          hash,
          message: message.replace(/^(feat|feature|add):?\s*/i, ''),
        });
      } else if (
        message.includes('fix:') || message.includes('bug:') || message.includes('hotfix:')
      ) {
        categories['🐛 Bug Fixes'].push({
          hash,
          message: message.replace(/^(fix|bug|hotfix):?\s*/i, ''),
        });
      } else if (message.includes('docs:') || message.includes('documentation:')) {
        categories['📚 Documentation'].push({
          hash,
          message: message.replace(/^(docs|documentation):?\s*/i, ''),
        });
      } else if (message.includes('perf:') || message.includes('performance:')) {
        categories['⚡ Performance'].push({
          hash,
          message: message.replace(/^(perf|performance):?\s*/i, ''),
        });
      } else if (message.includes('test:') || message.includes('testing:')) {
        categories['🧪 Testing'].push({
          hash,
          message: message.replace(/^(test|testing):?\s*/i, ''),
        });
      } else if (message.includes('security:') || message.includes('sec:')) {
        categories['🔒 Security'].push({
          hash,
          message: message.replace(/^(security|sec):?\s*/i, ''),
        });
      } else if (
        message.includes('ci:') || message.includes('build:') || message.includes('chore:')
      ) {
        categories['🏗️ Build/CI'].push({
          hash,
          message: message.replace(/^(ci|build|chore):?\s*/i, ''),
        });
      } else if (message.includes('deps:') || message.includes('dependency:')) {
        categories['📦 Dependencies'].push({
          hash,
          message: message.replace(/^(deps|dependency):?\s*/i, ''),
        });
      } else {
        categories['🔧 Maintenance'].push({ hash, message });
      }
    });

    // Генерируем markdown
    let changelog = `# Changelog\n\n`;
    changelog += `All notable changes to this project will be documented in this file.\n\n`;

    const now = new Date();
    const version = `v${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${
      String(now.getDate()).padStart(2, '0')
    }`;
    changelog += `## [${version}] - ${now.toISOString().split('T')[0]}\n\n`;

    // Добавляем категории с изменениями
    Object.entries(categories).forEach(([category, items]) => {
      if (items.length > 0) {
        changelog += `### ${category}\n\n`;
        items.forEach((item) => {
          changelog += `- ${item.message} (\`${item.hash}\`)\n`;
        });
        changelog += '\n';
      }
    });

    // Добавляем информацию о контрибьюторах
    try {
      const contributors = execSync(`git shortlog -sn ${lastTag}..HEAD | head -10`, {
        encoding: 'utf8',
      }).trim();
      if (contributors) {
        changelog += '### 🤝 Contributors\n\n';
        changelog += '```\n' + contributors + '\n```\n\n';
      }
    } catch (error) {
      // Игнорируем ошибки с контрибьюторами
    }

    changelog += '---\n\n';
    changelog += `*Generated on: ${new Date().toISOString()}*\n`;

    fs.writeFileSync(changelogPath, changelog);
    console.log(`✅ CHANGELOG.md сгенерирован: ${changelogPath}`);
  } catch (error) {
    console.error('❌ Ошибка генерации changelog:', error.message);
    process.exit(1);
  }
}

generateChangelog();
