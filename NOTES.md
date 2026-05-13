# Sudoky Web — заметки по проекту

## Старый проект
- Путь к нему ../sudoky_v3

## Стек
- React 18 + TypeScript + Vite + Tailwind CSS
- Без бэкенда — всё в браузере
- localStorage для сохранения прогресса
- Docker: node:20-alpine build → nginx:alpine serve

---

## Реализовано

### Логика (порт с Delphi, Unit1.pas / Main.pas)
- `buildCandidates` — BapuaHt: базовая матрица допустимых значений (строка / столбец / квадрат / диагонали)
- `buildCandidatesAdvanced` — BapuaHt2: + naked pairs в квадратах, строках, столбцах + box-line reduction
- `countLogical` — Variants2(3): подсчёт клеток, решаемых логикой (метрика сложности)
- `nextLogicalMove` — VariantsД2(7): следующий детерминированный логический ход (для подсказки)
- `nextLogicalMoveRandom` — Variants2(1): случайный логический ход
- `isLogicallyForced` — Variants3: проверка, выводится ли значение клетки из остальных
- `solveLogically` — PackPew: решение пазла чистой логикой (без перебора)
- `countRedundant` / `hasRedundant` — Delen: сколько клеток избыточны (логически выводятся)
- `hasConflict` — FindError: проверка конфликтов по строке / столбцу / квадрату / диагоналям

### Генератор (то, что в оригинале не было реализовано)
- `generateSolvedGrid` — генерация полной валидной сетки бэктрекингом с shuffle
- `generatePuzzleHard` — порт Generatory_hard: убирает по одной клетке, минимизируя логических ходов
- `generatePuzzleDouble` — порт Generatory_double: убирает по две клетки за раз
- Режим **диагонального судоку** (обе диагонали должны содержать 1–9)

### Сложности
| Режим | Алгоритм | Ограничения |
|-------|----------|-------------|
| Лёгкий | generatePuzzleHard, базовые ограничения | `advanced=false` |
| Средний | generatePuzzleDouble, базовые ограничения | `advanced=false` |
| Сложный | generatePuzzleHard, расширенные ограничения | `advanced=true` (BapuaHt2) |

### UI / UX
- Адаптивный layout: mobile (доска сверху + цифры снизу) / desktop (доска + панель рядом)
- Светлая тема + режим e-ink (см. ниже)
- Выделение: выбранная клетка, соседи (строка / столбец / квадрат / диагональ), одинаковые цифры
- Toggle: повторный тап на цифру в клетке — стирает её
- Подсказка: вставляет один логически выводимый ход
- Таймер
- Клавиатура: цифры 1–9, Backspace/Delete/0 — стереть, стрелки — навигация, H — подсказка
- `touch-action: manipulation` — нет 300ms задержки на мобиле
- localStorage: пазл, прогресс, сложность, диагональный режим, таймер сохраняются между сессиями
- HMR через Vite (изменения применяются мгновенно, в т.ч. на телефоне в той же сети)

---

## TODO / Backlog

### Функциональность
- [ ] **Заметки в клетках** — пометить несколько кандидатов (LV / LV2 из оригинала)
- [ ] **Режим ошибок** — показывать конфликты в реальном времени (E[] из оригинала), сейчас только через hasConflict
- [ ] **Кнопка "Решить"** — заполнить пазл из solution целиком
- [ ] **Счётчик подсказок / ошибок** — статистика за партию
- [ ] **История** — сохранять завершённые партии (время, сложность, дата)
- [ ] **Undo/Redo** — отмена последнего хода
- [ ] **Проверка** — кнопка "Проверить" чтобы подсветить все ошибки разом

### Генератор
- [ ] **Пополнение базы** — возможность добавить своё решённое судоку (как в оригинале через AddGenFile), сейчас база — только бэктрекинг
- [ ] **Web Worker** — вынести генерацию в воркер, чтобы не блокировать UI на сложном режиме
- [ ] **Seed / шаринг** — генерировать пазл по seed-у, чтобы поделиться конкретным пазлом ссылкой

### Визуал
- [ ] **Анимация победы** — что-нибудь при решении
- [ ] **Темная тема** — переключатель light / dark
- [ ] **Размер шрифта** — настройка для слабовидящих / крупный экран

---

## Темы (`src/hooks/useSettings.ts`)

Настройки хранятся в `localStorage` (ключи `settings.*`). Кнопка ⚙ в хедере открывает `SettingsModal`.

Интерфейс `AppTheme` передаётся пропом в `Board` и `Controls`. Новую настройку — добавить поле в `Settings` + при необходимости поле в `AppTheme`, строку в `SettingsModal`.

### Дефолтная тема (светлая)
| Слот | Значение |
|------|----------|
| `cellSelectedBg` | `bg-blue-500` |
| `cellSameVal` | `bg-blue-100` |
| `cellPeer` | `bg-gray-100` |
| `cellSolvedBg` | `bg-emerald-50` |
| `cellDiagBg` | `bg-amber-50` |
| `numDoneInactive` | `bg-emerald-50 text-emerald-600 border-emerald-300` |
| `accent` / `accentBorder` | `bg-blue-500` / `border-blue-500` |
| `borderThick` | `border-*-gray-500` (2px) |
| `borderThin` | `border-*-gray-300` (1px) |
| `eraserActive` | `bg-gray-300 text-gray-700 border-gray-400` |
| `textMuted` | `text-gray-400` |

### E-ink тема (Bigme B751C и аналоги)
Высокий контраст вместо синих акцентов, утолщённые границы клеток, насыщенные фоны там, где цвет плохо воспроизводится.

| Слот | Значение |
|------|----------|
| `cellSelectedBg` | `bg-gray-900` |
| `cellSameVal` | `bg-gray-900` (+ `cellSameValText: text-white`) |
| `cellPeer` | `bg-gray-200` |
| `cellSolvedBg` | `bg-emerald-300` |
| `cellDiagBg` | `bg-amber-200` |
| `numDoneInactive` | `bg-emerald-400 text-emerald-600 border-emerald-300` |
| `accent` / `accentBorder` | `bg-gray-900` / `border-gray-900` |
| `boardBorder` | `border-2 border-gray-900` |
| `borderThick` | `border-*-gray-800` (2px) |
| `borderThin` | `border-*-gray-600` (1px) |
| `eraserActive` | `bg-gray-900 text-white border-gray-900` |
| `textMuted` | `text-gray-700` |

### Инфраструктура
- [ ] **docker-compose.yml** — если нужно поднимать в связке с чем-то
- [ ] **CI** — сборка и линт при push
