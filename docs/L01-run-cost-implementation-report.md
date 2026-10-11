# L01 — Run Cost: звіт про реалізацію

Фактичний стан після реалізації (2026-10-11, гілка `lab/l01`, зміни ще не закомічені).
Специфікації: [`server/specs/L01-run-cost.md`](../server/specs/L01-run-cost.md) ·
[`client/specs/L01-run-cost.md`](../client/specs/L01-run-cost.md).

## Що реалізовано

**Server**
- Міграція `0010_sleepy_wild_child.sql` (згенерована `pnpm db:generate`): нові nullable-колонки
  `agent_runs.cost_usd` (`double precision`) і `agent_runs.review_batch_id` (`uuid`).
- Один `POST /pulls/:id/review` → один `review_batch_id` (`randomUUID()`) для всіх прогонів цього запуску.
- `completeAgentRun` зберігає `cost_usd` з `outcome.costUsd` движка (без додаткових викликів моделі);
  failed / cancelled → `null`. Те саме значення пишеться в `trace.stats.cost_usd`.
- `cost_usd` віддається в `GET /pulls/:id/runs`, `GET /runs/:id/trace`, `GET /repos/:id/pulls`.
- COST у списку PR = вартість **останнього Review** (останнього batch), правило в чистому хелпері
  `server/src/modules/pulls/cost.ts`: поки в batch є `running` → `null`; після завершення
  (done / failed / cancelled) → сума відомих `cost_usd`; жодної відомої → `null`.
- Контракти (`RunSummary.cost_usd`, `RunStats.cost_usd` nullish, `PrMeta.cost_usd`) змінено в обох копіях
  `vendor/shared`.

**Client**
- Новий спільний компонент `client/src/components/run-cost-badge/` (`RunCostBadge`, `formatUsd`,
  `formatTokenTotal`) у двох варіантах.
- Список PR: колонка **Cost** між Status і Updated — compact `$0.012`.
- Таймлайн Agent runs: під часом прогону — `9,119 tok · $0.0013` (як у макеті); для `running` бейджа немає.
- Сайдбар Agent run: плитка **COST** між TOKENS і FINDINGS; окрема плитка TOKENS (`in→out`) без змін.
- Відсутні дані — завжди `—`, ніколи `$0.00`.

### Historical runs

Прогони, створені до L01, не мають `cost_usd` і `review_batch_id` (backfill не робився — це погоджене
рішення). Вони показують **`—`** скрізь: у таймлайні, у сайдбарі, а PR, чий останній прогін історичний,
показує `—` у колонці Cost. Підтверджено на живому API для PR #2: усі три старі прогони повертають
`cost_usd: null`.

## Написані тести

**UI (Vitest + RTL)**

| Файл | Що додано |
|---|---|
| `client/src/components/run-cost-badge/RunCostBadge.test.tsx` (новий) | 16 тестів: `formatUsd` (8), `formatTokenTotal` (3), `RunCostBadge` (5): compact, detailed, `—` + підказка, без токенів при `0/0` і `null`, `9,119 tok · —` |
| `client/src/app/repos/[repoId]/pulls/_components/PRRow/PRRow.test.tsx` (новий) | 2 тести: колонка COST — C1, C2 |
| `.../pulls/[number]/_components/RunHistory/RunHistory.test.tsx` | +3 тести: C3 (`9,119 tok · $0.0013`), C4 (failed → `—`), C5 (`running` без бейджа) |
| `.../pulls/[number]/_components/RunTraceDrawer/RunTraceDrawer.test.tsx` | +2 тести: C6 (COST → `$0.060`), C7 (trace без `cost_usd` → `—`) |

**Backend (Vitest)**

| Файл | Що додано |
|---|---|
| `server/test/pulls-cost.test.ts` (новий) | 8 unit-тестів `latestReviewCostByPr`: S6–S10, PR без прогонів, відомий `0`, кілька PR |
| `server/test/contracts.test.ts` | Новий тест на `cost_usd` у `RunStats` / `RunSummary` / `PrMeta`; в існуючий тест RunTrace — перевірка, що trace без `cost_usd` парситься |
| `server/test/reviews.it.test.ts` | Новий тест «L01 cost…» (S1, S5, S6, S7, S10, роути runs і trace); існуючий «run all» розширено перевіркою спільного `review_batch_id` (S4) |

## Запуски тестів і результати

| Що | Результат |
|---|---|
| Client, повний набір (`npx vitest run`) | 12 файлів, 44 тести — усі зелені |
| Client, `RunCostBadge.test.tsx` окремо | 16 / 16 зелені |
| Client, `tsc --noEmit` | без помилок |
| Server, `pulls-cost` + `contracts` + `pulls-status` + `routes-smoke` | 27 / 27 зелені |
| Server, повний набір | 104 зелені, **6 впали**, **29 пропущено** (див. нижче) |
| Server, `pnpm typecheck` | без помилок (також після додавання mock для openrouter) |
| `reviews.it.test.ts`, typecheck окремим tsconfig | без помилок (серверний tsconfig не включає `test/`) |
| Replay integration-сценарію на тимчасовій БД (скрипт поза repo) | 12 / 12 PASS |

Replay-скрипт повторює сценарій нового integration-тесту на справжньому Postgres: тимчасова БД
`devdigest_l01_check` у локальному Postgres → `runMigrations()` + `seed()` + `buildApp` з mock LLM →
перевірки → `DROP DATABASE`. Знадобилося чотири спроби:
1. TS сприйняв скрипт як CJS (top-level await).
2. Windows-шляхи без `file://` в імпортах.
3. Засіяні openrouter-агенти пішли в справжній OpenRouter, прогони зависли.
4. Пройшла після підміни openrouter на mock.

Повний серверний прогін був до додавання mock для openrouter у `reviews.it.test.ts`; ця зміна стосується
лише `.it`-файлу, який однаково пропускається.

## Failing / skipped тести

- **Failing — 6 тестів у `server/test/indexer-pipeline.test.ts` (repo-intel), не пов'язані з фічею.**
  Падають з `ENOENT: no such file or directory, open 'C:\Users\…\Temp\repo-intel-…\src\….ts'` на
  тимчасових файлах, які тест створює сам. Змінені модулі не входять у його ланцюжок імпортів.
  На чистому HEAD не перевірялось — що це падало й до L01, лише припущення.
- **Skipped — 29 тестів, тобто всі 6 файлів `*.it.test.ts`**, включно з новим L01-тестом і розширеним
  «run all» у `reviews.it.test.ts`. Причина: Docker CLI не відповідає (`docker info` / `docker version`
  висять), тож `dockerAvailable()` повертає `false` і testcontainers-тести пропускаються.
  **Ці integration-тести жодного разу не виконувались**; їхній сценарій перевірено лише replay-скриптом.

## Змінені mocks і fixtures

| Де | Зміна | Навіщо |
|---|---|---|
| `RunHistory.test.tsx` | у фікстуру `run()` додано `cost_usd: null`; у провайдер — namespace `common` | `cost_usd` у `RunSummary` тепер обов'язкове поле (без нього tsc TS2719); `common` потрібен для підказки «Cost unknown» |
| `RunTraceDrawer.test.tsx` | у `TRACE.stats` повернуто `cost_usd: 0.06`; змінний `mockTrace` зі скиданням в `afterEach` | значення як до коміту `d45ab0d`; `mockTrace` — щоб у C7 подати trace без `cost_usd` |
| `PRRow.test.tsx` (новий) | mock `next/navigation` (`useRouter`), фікстура `PrMeta`, провайдер з `prReview` + `common` | `PRRow` викликає `useRouter`, а в jsdom немає App Router |
| `reviews.it.test.ts`, `appWith` | `openrouter: new MockLLMProvider('openai', { structured })` | `config.ts` робить `import 'dotenv/config'`, тож без mock засіяні openrouter-агенти в «run all» ходили б у справжній API з ключем із `server/.env` |
| `contracts.test.ts` | імпорти `RunStats`, `RunSummary`, `PrMeta` | для нового тесту |

Серверний `MockLLMProvider` не змінювався — він уже повертав `costUsd: 0.001`.

## Використані skills

- **engineering-insights** — викликано один раз через Skill на початку реалізації; валідатор
  `check-insights.mjs` запускався після кожного запису. На етапі специфікації `INSIGHTS.md`
  читались вручну, без виклику скіла.
- Інші skills (drizzle-orm-patterns, react-testing-library, zod тощо) не викликались.

## Нові записи в INSIGHTS.md

**`server/INSIGHTS.md`**
- What Works — «On Windows apply migrations by calling `runMigrations()` directly».
- What Works — «When Docker CLI hangs, replay an `.it` scenario on a throwaway DB».
- Recurring Errors & Fixes — «`server/.env` keys reach tests — un-mocked `openrouter` agents call the real
  API»; у Status дописано: виправлено в `reviews.it.test.ts`, інші `.it`-файли не перевірені.
- Open Questions — «`indexer-pipeline.test.ts` fails on Windows with ENOENT» (unverified).
- Session Notes — «L01 run cost».
- В існуючому записі «Run cost is computed but not persisted (L01)» дописано в Status: fixed (2026-10-11).

**`client/INSIGHTS.md`**
- Codebase Patterns — «Components using `RunCostBadge` need the `common` namespace in tests».

## Зміни поза початковим планом

**У репозиторії**
- `server/src/db/migrations/meta/_journal.json`, `meta/0010_snapshot.json` — згенерував `drizzle-kit`
  разом із міграцією; вручну не редагувались.
- `client/src/components/run-cost-badge/styles.ts` — окремий файл стилів за конвенцією `src/components/*`
  (у плані були лише компонент, helpers, index).
- `server/src/modules/reviews/repository.ts` — класова обгортка над `run.repo.ts`; довелося прокинути
  `reviewBatchId` і `costUsd` (у плані згадувались лише функції `createAgentRun` / `completeAgentRun`).
- `server/test/reviews.it.test.ts` — mock для openrouter, на окремий запит після основної реалізації.
- `server/INSIGHTS.md`, `client/INSIGHTS.md` — оновлення обов'язкове за `CLAUDE.md`.
- `docs/L01-run-cost-implementation-report.md` — цей звіт.

**Поза репозиторієм / побічні ефекти**
- Міграцію `0010` застосовано до локальної dev-БД прямим викликом `runMigrations()`, бо
  `pnpm db:migrate` на Windows завершується з кодом 0, нічого не застосувавши. Перевірено: 11 записів у
  `drizzle.__drizzle_migrations`, обидві колонки існують.
- Тимчасову БД `devdigest_l01_check` створено й видалено кілька разів; видалення перевірено.
- Під час третьої спроби replay-скрипта три засіяні агенти зробили справжні запити до OpenRouter
  з ключем із `server/.env` (diff в один рядок — частки цента).
- У scratchpad сесії лишились `l01-cost-check.mts` і `tsconfig.it.json` (не в repo).

## Ручна / e2e перевірка

- **Підтверджено:** живий API (dev-сервер на `:3001`, перезавантажився з новим кодом) віддає `cost_usd`:
  `GET /repos/:id/pulls` → `cost_usd: null` для PR #1 і #2; `GET /pulls/:id/runs` для PR #2 → три старі
  прогони з токенами і `cost_usd: null`.
- **Підтверджено вручну (після створення звіту):** web був запущений, UI перевірено в браузері.
  На PR #2 виконано новий Run Review через реальний OpenRouter.
  - У таймлайні Agent runs нові прогони показали total tokens і cost; historical runs показують `—`.
  - Total tokens у DevDigest точно збіглися з OpenRouter logs:

    | Прогін | DevDigest (in + out) | OpenRouter |
    |---|---|---|
    | 1 | 3540 + 84 | 3624 |
    | 2 | 3320 + 495 | 3815 |
    | 3 | 4335 + 344 | 4679 |

  - Cost відповідає правильним OpenRouter requests.
- E2e-тести (`e2e/`) не запускались.

### Follow-up: точність малих значень cost

Виявлено окремий formatting issue. Дуже малі значення UI зараз округлює до 4 знаків після коми
(`formatUsd`, гілка `< $0.01`):

| OpenRouter | UI зараз |
|---|---|
| $0.000722 | $0.0007 |
| $0.000356 | $0.0004 |
| $0.000456 | $0.0005 |

Збережене значення `cost_usd` точне — втрачається лише точність відображення. Зараз не
виправлялось; заплановано як окремий маленький commit після основної фічі.
