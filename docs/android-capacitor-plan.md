# План переноса на Android (Capacitor)

Проект: React + TypeScript + Tailwind + Vite, собирается в статику.
Стратегия: Capacitor оборачивает `dist/` в нативный WebView, код в `src/` не дублируется.

## Шаг 1 — Установить Capacitor

```bash
npm install @capacitor/core @capacitor/android
npx cap init "Sudoky" "com.yourname.sudoky" --web-dir dist
npx cap add android
```

## Шаг 2 — Исправить `vite.config.ts`

`base: '/sudoku/'` сломает Capacitor — файлы загружаются локально, а не с сервера.

```ts
base: process.env.CAPACITOR ? './' : '/sudoku/',
```

Сборка для Android:

```bash
CAPACITOR=1 npm run build && npx cap sync
```

## Шаг 3 — Адаптация UI под мобильный экран

**Клавиатура** — хендлеры в `App.tsx` (keydown) на мобиле просто не срабатывают, ничего не сломается.

**Layout** — уже адаптивный (`md:flex-row`), нужно проверить на узком экране.

**Safe area (notch/вырез)** — добавить в `index.html`:

```html
<meta name="viewport" content="viewport-fit=cover, width=device-width, initial-scale=1.0">
```

И в `src/index.css`:

```css
header { padding-top: env(safe-area-inset-top); }
```

## Шаг 4 — Проверить `src/utils/share.ts`

Если использует `window.location`, на мобиле URL будет `capacitor://localhost/...`.
Нужно захардкодить базовый URL продакшен-сайта в логике формирования ссылки.

## Шаг 5 — Сборка и запуск

```bash
CAPACITOR=1 npm run build
npx cap sync
npx cap open android   # откроет Android Studio
```

В Android Studio: **Run → Run 'app'** на устройстве или эмуляторе.

## Оценка трудозатрат

| Задача | Время |
|--------|-------|
| Установка Capacitor | 15 мин |
| Правка `vite.config.ts` | 5 мин |
| Safe area + viewport | 10 мин |
| Проверка `share.ts` | 15 мин |
| Тестирование на эмуляторе | 1–2 часа |

**Итого: ~2–3 часа** (при установленном Android Studio)
