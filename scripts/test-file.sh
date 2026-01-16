#!/bin/bash
# Test File Runner - запускает конкретный тестовый файл

set -uo pipefail

# Exit codes обрабатываются явно

# Проверяем аргументы
if [[ $# -eq 0 ]]; then
  echo "❌ Ошибка: укажите путь к тестовому файлу"
  echo "Пример: pnpm run test:file packages/app/tests/unit/types/api.test.ts"
  exit 1
fi

TEST_FILE="$1"

# Проверяем существование файла
if [[ ! -f "$TEST_FILE" ]]; then
  echo "❌ Ошибка: файл не найден: $TEST_FILE"
  exit 1
fi

# Определяем тип проекта и имя
PROJECT_TYPE=""
PROJECT_NAME=""
TURBO_FILTER=""

if [[ "$TEST_FILE" =~ packages/([^/]+)/ ]]; then
  PROJECT_TYPE="package"
  PROJECT_NAME="${BASH_REMATCH[1]}"
  TURBO_FILTER="@livai/$PROJECT_NAME"
elif [[ "$TEST_FILE" =~ apps/([^/]+)/ ]]; then
  PROJECT_TYPE="app"
  PROJECT_NAME="${BASH_REMATCH[1]}"
  TURBO_FILTER="$PROJECT_NAME"
else
  echo "❌ Ошибка: файл должен быть в директории packages/ или apps/"
  exit 1
fi

# Цвета для вывода
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
CYAN="\033[36m"
BOLD="\033[1m"
RESET="\033[0m"

echo -e "${BOLD}🚀 LIVAI TEST FILE RUNNER${RESET}"
echo -e "${CYAN}📦 Пакет:${RESET} $TURBO_FILTER"
echo -e "${CYAN}🧪 Файл:${RESET} $TEST_FILE"
echo ""

# Определяем относительный путь к файлу в пакете/приложении
# Сначала нормализуем путь, убрав префикс проекта
NORMALIZED_FILE=$(echo "$TEST_FILE" | sed 's|^/home/boss/Projects/livai/||')

if [[ "$PROJECT_TYPE" == "package" ]]; then
  PACKAGE_DIR=$(echo "$NORMALIZED_FILE" | sed "s|packages/$PROJECT_NAME/||")
elif [[ "$PROJECT_TYPE" == "app" ]]; then
  PACKAGE_DIR=$(echo "$NORMALIZED_FILE" | sed "s|apps/$PROJECT_NAME/||")
else
  PACKAGE_DIR=""
fi

# Время начала
START_TIME=$(date +"%H:%M:%S")
START_TS=$(date +%s)

# Запускаем тесты для пакета или приложения
if [[ "$PROJECT_TYPE" == "package" ]]; then
  # Запускаем vitest напрямую в директории пакета
  PACKAGE_PATH="packages/$PROJECT_NAME"
  if [[ ! -d "$PACKAGE_PATH" ]]; then
    echo "❌ Ошибка: директория пакета не найдена: $PACKAGE_PATH"
    exit 1
  fi

  echo "📂 Запуск в директории: $PACKAGE_PATH"
  cd "$PACKAGE_PATH"
  # Запускаем vitest с конфигурацией из корня проекта
  TEST_FILE_MODE=true NODE_OPTIONS='--no-warnings' npx vitest run --config "../../config/vitest/vitest.config.ts" --coverage "$PACKAGE_DIR"
  VITEST_EXIT_CODE=$?
  # Возвращаемся в корневую директорию проекта
  cd - >/dev/null
  # Выходим с кодом от vitest
  exit $VITEST_EXIT_CODE
elif [[ "$PROJECT_TYPE" == "app" ]]; then
  # Для приложений запускаем напрямую в директории приложения
  APP_DIR="apps/$PROJECT_NAME"
  if [[ ! -d "$APP_DIR" ]]; then
    echo "❌ Ошибка: директория приложения не найдена: $APP_DIR"
    exit 1
  fi

  echo "📂 Запуск в директории: $APP_DIR"
  cd "$APP_DIR"
  TEST_FILE_MODE=true NODE_OPTIONS='--no-warnings' npx vitest run --coverage "$PACKAGE_DIR"
  # Возвращаемся в корневую директорию проекта
  cd - > /dev/null
else
  echo "❌ Ошибка: неизвестный тип проекта: $PROJECT_TYPE"
  exit 1
fi

# Время окончания и расчет длительности
END_TIME=$(date +"%H:%M:%S")
END_TS=$(date +%s)
DURATION=$(echo "$END_TS - $START_TS" | bc -l 2>/dev/null || echo "1.0")
DURATION=$(printf "%.2fs" "$DURATION" | sed 's/,/./g')

# Вывод покрытия для отдельного файла
show_file_coverage() {
  local coverage_dir=""
  local coverage_file=""

  if [[ "$PROJECT_TYPE" == "package" ]]; then
    coverage_dir="packages/$PROJECT_NAME"
    coverage_file="$coverage_dir/coverage/coverage-final.json"
  elif [[ "$PROJECT_TYPE" == "app" ]]; then
    coverage_dir="apps/$PROJECT_NAME"
    coverage_file="$coverage_dir/coverage/coverage-final.json"
  else
    echo ""
    echo -e "${YELLOW}Coverage data not available - unknown project type${RESET}"
    return
  fi

  # Проверяем файл из корневой директории проекта
  if [[ -f "$coverage_file" ]] && command -v jq &> /dev/null; then
    echo ""
    echo -e "${CYAN}📊 COVERAGE SUMMARY${RESET}"
    echo "────────────────────────────────────────"
    echo -e "${GREEN}✅ Coverage generated for tested files${RESET}"

    # Вычисляем общую статистику
    local total_statements=0
    local covered_statements=0
    local total_branches=0
    local covered_branches=0
    local total_functions=0
    local covered_functions=0

    # Собираем статистику по всем файлам
    while IFS= read -r file; do
      if [[ -n "$file" ]]; then
        # Statements
        local file_statements=$(jq -r ".[\"$file\"].statementMap | length" "$coverage_file" 2>/dev/null || echo "0")
        local file_covered_statements=$(jq -r ".[\"$file\"].s | to_entries | map(select(.value > 0)) | length" "$coverage_file" 2>/dev/null || echo "0")

        # Branches
        local file_branches=$(jq -r ".[\"$file\"].branchMap | length" "$coverage_file" 2>/dev/null || echo "0")
        local file_covered_branches=$(jq -r ".[\"$file\"].b | to_entries | map(select(.value[0] > 0 or .value[1] > 0)) | length" "$coverage_file" 2>/dev/null || echo "0")

        # Functions
        local file_functions=$(jq -r ".[\"$file\"].fnMap | length" "$coverage_file" 2>/dev/null || echo "0")
        local file_covered_functions=$(jq -r ".[\"$file\"].f | to_entries | map(select(.value > 0)) | length" "$coverage_file" 2>/dev/null || echo "0")

        total_statements=$((total_statements + file_statements))
        covered_statements=$((covered_statements + file_covered_statements))
        total_branches=$((total_branches + file_branches))
        covered_branches=$((covered_branches + file_covered_branches))
        total_functions=$((total_functions + file_functions))
        covered_functions=$((covered_functions + file_covered_functions))
      fi
    done < <(jq -r 'keys[]' "$coverage_file" 2>/dev/null)

    # Вычисляем проценты
    local lines_pct=0
    local functions_pct=0
    local branches_pct=0
    local statements_pct=0

    if [[ $total_statements -gt 0 ]]; then
      statements_pct=$(awk "BEGIN{printf \"%.1f\", ($covered_statements/$total_statements)*100}")
      lines_pct=$statements_pct  # Для простоты используем statements как lines
    fi

    if [[ $total_functions -gt 0 ]]; then
      functions_pct=$(awk "BEGIN{printf \"%.1f\", ($covered_functions/$total_functions)*100}")
    fi

    if [[ $total_branches -gt 0 ]]; then
      branches_pct=$(awk "BEGIN{printf \"%.1f\", ($covered_branches/$total_branches)*100}")
    fi

    # Цвета для процентов
    local lines_color=$GREEN
    local functions_color=$GREEN
    local branches_color=$GREEN
    local statements_color=$GREEN

    (( $(echo "$lines_pct < 80" | bc -l 2>/dev/null || echo "0") )) && lines_color=$YELLOW
    (( $(echo "$lines_pct < 50" | bc -l 2>/dev/null || echo "0") )) && lines_color=$RED

    (( $(echo "$functions_pct < 80" | bc -l 2>/dev/null || echo "0") )) && functions_color=$YELLOW
    (( $(echo "$functions_pct < 50" | bc -l 2>/dev/null || echo "0") )) && functions_color=$RED

    (( $(echo "$branches_pct < 80" | bc -l 2>/dev/null || echo "0") )) && branches_color=$YELLOW
    (( $(echo "$branches_pct < 50" | bc -l 2>/dev/null || echo "0") )) && branches_color=$RED

    (( $(echo "$statements_pct < 80" | bc -l 2>/dev/null || echo "0") )) && statements_color=$YELLOW
    (( $(echo "$statements_pct < 50" | bc -l 2>/dev/null || echo "0") )) && statements_color=$RED

    echo -e "Lines      : ${lines_color}${lines_pct}%${RESET}"
    echo -e "Functions  : ${functions_color}${functions_pct}%${RESET}"
    echo -e "Branches   : ${branches_color}${branches_pct}%${RESET}"
    echo -e "Statements : ${statements_color}${statements_pct}%${RESET}"

    # Показываем покрытие по файлам
    echo ""
    echo -e "${CYAN}📁 FILE COVERAGE DETAILS${RESET}"
    echo "────────────────────────────────────────"

    local has_coverage=false
    while IFS= read -r file; do
      if [[ -n "$file" ]]; then
        # Получаем общее количество statements из statementMap
        local file_statements=$(jq -r ".[\"$file\"].statementMap | length" "$coverage_file" 2>/dev/null || echo "0")

        if [[ "$file_statements" -gt 0 ]]; then
          # Получаем количество выполненных statements (значения > 0 в s)
          local file_covered=$(jq -r ".[\"$file\"].s | to_entries | map(select(.value > 0)) | length" "$coverage_file" 2>/dev/null || echo "0")

          # Показываем только файлы с ненулевым покрытием
          if [[ "$file_covered" -gt 0 ]]; then
            has_coverage=true
            local pct=$(awk "BEGIN{printf \"%.1f\", ($file_covered/$file_statements)*100}")

            # Цвет в зависимости от процента
            if (( $(echo "$pct < 50" | bc -l 2>/dev/null || echo "0") )); then
              local color=$RED
            elif (( $(echo "$pct < 80" | bc -l 2>/dev/null || echo "0") )); then
              local color=$YELLOW
            else
              local color=$GREEN
            fi

            # Сокращаем длинные пути
            local short_file=$(basename "$file")
            local dir=$(dirname "$file" | sed 's|.*/packages/||' | sed 's|.*/src/||')

            printf "%-15s %s%5.1f%%%s  %s/%s\n" "Lines:" "$color" "$pct" "$RESET" "${dir:-.}" "$short_file"
          fi
        fi
      fi
    done < <(jq -r 'keys[]' "$coverage_file" 2>/dev/null)

    if [[ "$has_coverage" = false ]]; then
      echo -e "${YELLOW}No executable code coverage (type tests only)${RESET}"
    fi

    echo "────────────────────────────────────────"
    echo -e "Coverage HTML: ${CYAN}$coverage_dir/coverage/lcov-report/index.html${RESET}"
  else
    echo ""
    echo -e "${YELLOW}Coverage data not available for this file${RESET}"
  fi
}

# Показываем покрытие
show_file_coverage

# Вывод итоговой статистики - результаты показаны выше в выводе turbo
echo ""
echo -e "${BOLD}Test execution completed${RESET}"
echo -e "${BOLD}Start at  ${RESET}  $START_TIME"
echo -e "${BOLD}Duration  ${RESET}  $DURATION"

echo ""
echo -e "${BOLD}Start at:${RESET} $START_TIME"
echo -e "${BOLD}End at  :${RESET} $END_TIME"

# Exit code обрабатывается trap