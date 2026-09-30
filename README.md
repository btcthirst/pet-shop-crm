# pet-shop-crm

Внутрішня CRM зоомагазину: каталог товарів, залишки на складі, клієнти, замовлення та дві ролі користувачів (Admin / Manager).

Розробка ведеться за технічною специфікацією `pet-shop-crm — технічна специфікація.md`.

**Стан: етап 0 (каркас проєкту).** Реалізовано інфраструктуру — Next.js, Prisma зі схемою БД і міграціями, shadcn/ui, ESLint + Prettier, Vitest, CI. Доменна логіка, сторінки та API з'являються на наступних етапах (див. «План»).

## Стек

| Шар               | Технологія                                                                |
| ----------------- | ------------------------------------------------------------------------- |
| Runtime           | Node.js 24 (`.nvmrc`), `engines`: `>=22.12`                               |
| Пакетний менеджер | pnpm 12 (`packageManager`)                                                |
| Фреймворк         | Next.js 16 (App Router, Turbopack), TypeScript strict                     |
| UI                | Tailwind CSS 4, shadcn/ui (radix)                                         |
| Таблиці й форми   | TanStack Table, React Hook Form, Zod                                      |
| БД                | PostgreSQL (Neon)                                                         |
| ORM               | Prisma 7 (`prisma-client` generator, driver adapter `@prisma/adapter-pg`) |
| Авторизація       | Auth.js (Credentials) + bcryptjs — етап 1                                 |
| Тести             | Vitest (unit), Playwright (e2e) — етап 7                                  |
| CI                | GitHub Actions                                                            |

## Запуск

```bash
nvm use                    # Node 24 з .nvmrc
pnpm install
cp .env.example .env       # заповнити рядки Neon та AUTH_SECRET
pnpm db:migrate            # застосувати міграції
pnpm db:seed               # демо-дані (етап 1)
pnpm dev                   # http://localhost:3000
```

### Змінні середовища

| Змінна             | Призначення                                               |
| ------------------ | --------------------------------------------------------- |
| `DATABASE_URL`     | pooled-рядок Neon (хост містить `-pooler`) для застосунку |
| `DIRECT_URL`       | прямий рядок Neon для Prisma CLI (міграції, seed, studio) |
| `DATABASE_URL_DEV` | те саме для гілки `dev` Neon — локальна розробка          |
| `DIRECT_URL_DEV`   | те саме для гілки `dev` Neon — міграції під час розробки  |
| `AUTH_SECRET`      | `openssl rand -base64 32`                                 |

Локально `DATABASE_URL_DEV` / `DIRECT_URL_DEV` мають пріоритет над основними (див. `src/lib/env.ts` і `prisma.config.ts`), тому розробка не зачіпає демо-дані. На Vercel і в CI змінних `*_DEV` немає — там використовується основна база. Щоб застосувати міграції до основної гілки вручну: `DIRECT_URL=<прямий рядок> pnpm db:deploy`.

`.env` у `.gitignore`, у репозиторії лише `.env.example`.

## Скрипти

| Скрипт                    | Команда                            | Призначення                                      |
| ------------------------- | ---------------------------------- | ------------------------------------------------ |
| `dev`                     | `next dev`                         | Локальний запуск                                 |
| `build`                   | `prisma generate && next build`    | Збірка                                           |
| `start`                   | `next start`                       | Запуск збірки                                    |
| `lint`                    | `eslint .`                         | Лінтинг                                          |
| `format` / `format:check` | `prettier --write .` / `--check .` | Форматування                                     |
| `typecheck`               | `tsc --noEmit`                     | Перевірка типів                                  |
| `test`                    | `vitest run`                       | Unit та integration тести                        |
| `test:coverage`           | `vitest run --coverage`            | Тести з порогом покриття 80% для доменної логіки |
| `test:e2e`                | `playwright test`                  | E2E тести                                        |
| `db:migrate`              | `prisma migrate dev`               | Створення й застосування міграцій                |
| `db:deploy`               | `prisma migrate deploy`            | Застосування міграцій у CI та на деплої          |
| `db:seed`                 | `prisma db seed`                   | Тестові дані                                     |
| `db:reset`                | `prisma migrate reset`             | Очищення БД разом із seed                        |
| `db:studio`               | `prisma studio`                    | Перегляд даних                                   |
| `db:generate`             | `prisma generate`                  | Генерація Prisma Client                          |

## Структура

```
pet-shop-crm/
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/          (init + CHECK-обмеження)
│  └─ seed.ts              (етап 1)
├─ prisma.config.ts        (Prisma 7: datasource url, seed)
├─ src/
│  ├─ app/                 (сторінки та /api — етапи 1–6)
│  ├─ features/            products | stock | customers | orders
│  ├─ lib/                 db.ts, errors.ts, money.ts (auth.ts, permissions.ts — етап 1)
│  └─ generated/prisma/    Prisma Client (генерується, у gitignore)
├─ tests/                  unit/ | integration/ | e2e/
└─ .github/workflows/ci.yml
```

## Схема БД

Моделі: `User`, `Category`, `Product`, `StockMovement`, `Customer`, `Order`, `OrderItem`, `OrderStatusHistory`. Гроші зберігаються в копійках (`priceKopecks`, `unitPriceKopecks`, `totalKopecks`). Повний опис — у `prisma/schema.prisma`.

Окрім схеми Prisma застосовуються CHECK-обмеження (`prisma/migrations/*_constraints`):

- `Product.stock >= 0`
- `Product.priceKopecks >= 0`
- `OrderItem.quantity > 0`

## Ролі й тестові облікові дані

| Дія                                                     | Admin | Manager |
| ------------------------------------------------------- | ----- | ------- |
| Перегляд каталогу й залишків                            | ✅    | ✅      |
| Створення й редагування товарів і категорій, зміна ціни | ✅    | ❌      |
| Прихід на склад (RESTOCK)                               | ✅    | ✅      |
| Коригування залишку (CORRECTION)                        | ✅    | ❌      |
| Клієнти: створення й редагування                        | ✅    | ✅      |
| Видалення клієнта без замовлень                         | ✅    | ❌      |
| Замовлення: створення, зміна статусу, скасування        | ✅    | ✅      |
| Керування користувачами                                 | ✅    | ❌      |

Демо-користувачів буде створено в `pnpm db:seed` (етап 1): `admin@petshop.local` та `manager@petshop.local`. Паролі — тільки в README, у проді не використовуються.

## CI

`.github/workflows/ci.yml`: `pnpm install --frozen-lockfile` → `lint` → `typecheck` → `db:deploy` (Postgres 16 як service container) → `test` → `build`.

## Відхилення від специфікації

Специфікація була написана до сучасних мажорних версій бібліотек. Що змінилося:

- **Prisma 7**: генератор `prisma-client-js` deprecated → `prisma-client` з обов'язковим `output` (`src/generated/prisma`). Рядки підключення переїхали з `datasource` у `prisma.config.ts` (`DIRECT_URL` з fallback на `DATABASE_URL`), `url`/`directUrl` у схемі більше не задаються. Клієнт створюється через driver adapter `@prisma/adapter-pg`. Seed задається у `prisma.config.ts`, а не в `package.json`; `migrate dev` більше не запускає seed і generate автоматично. Початкова міграція згенерована офлайн через `prisma migrate diff --from-empty --to-schema` (секрети/БД не потрібні).
- **pnpm 12**: `onlyBuiltDependencies` замінено на `allowBuilds` у `pnpm-workspace.yaml` (`prisma`, `@prisma/engines`, `esbuild`, `@tailwindcss/oxide`, `sharp`, `unrs-resolver`). Старе поле вже ігнорується з pnpm 11.
- **Next.js 16 + Tailwind 4**: Turbopack за замовчуванням, shadcn/ui ініціалізовано в новому CLI (`style: radix-nova`).
- **bcryptjs 3** має власні типи, тому `@types/bcryptjs` не встановлювався.
- Точки монтування middleware у Next 16 (`src/proxy.ts` замість `src/middleware.ts`) перевіряються на етапі 1.

## План

Етапи 1–7 — авторизація, каталог, склад, клієнти, замовлення, дашборд, тести й деплой — за планом розділу 13 специфікації.
