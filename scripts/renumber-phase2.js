#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const filePath = join(__dirname, '..', 'docs', 'phase2-UI.md');
const startLine = 144;
const endLine = 617;

// Функция для генерации эмодзи-номера
function getEmojiNumber(num) {
  return num.toString().split('').map((d) => {
    const map = {
      '0': '0️⃣',
      '1': '1️⃣',
      '2': '2️⃣',
      '3': '3️⃣',
      '4': '4️⃣',
      '5': '5️⃣',
      '6': '6️⃣',
      '7': '7️⃣',
      '8': '8️⃣',
      '9': '9️⃣',
    };
    return map[d] || '0️⃣';
  }).join('');
}

const content = readFileSync(filePath, 'utf-8');
const lines = content.split('\n');
const newLines = [];
let currentNumber = 1;

// Регулярное выражение: любая последовательность эмодзи-цифр в начале строки
const emojiRegex = /^([0-9]️⃣+)\s/;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const lineNum = i + 1;

  if (lineNum >= startLine && lineNum <= endLine) {
    if (emojiRegex.test(line)) {
      const newEmoji = getEmojiNumber(currentNumber);
      newLines.push(line.replace(emojiRegex, `${newEmoji} `));
      currentNumber++;
    } else {
      newLines.push(line);
    }
  } else {
    newLines.push(line);
  }
}

writeFileSync(filePath, newLines.join('\n'), 'utf-8');
console.log(`✅ Перенумеровано ${currentNumber - 1} строк`);
