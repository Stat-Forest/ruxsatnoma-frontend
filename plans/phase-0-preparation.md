# Фаза 0 — Подготовка и разблокировка

> **Для агентов:** используйте `superpowers:subagent-driven-development` или `superpowers:executing-plans` для выполнения. Шаги отмечены чекбоксами `- [ ]`.

**Цель:** снять всё, что помешает начать разработку в сентябре — окружение, доступы, данные, ответы Заказчика.

**Архитектура:** кода продукта в этой фазе нет. Поднимаем инфраструктуру, проверяем схему БД на живой базе, добываем из старой системы то, что можно добыть без Заказчика, и отправляем вопросы.

**Стек:** Docker Compose, PostgreSQL 18 + PostGIS 3.6, Redis 7, RabbitMQ 3, MinIO, Next.js 15.

## Глобальные ограничения

Полный список — в [`00-roadmap.md`](00-roadmap.md), раздел «Глобальные ограничения». Для этой фазы существенны:

- Деньги — только `numeric(18,2)`.
- Время — только `timestamptz`, хранение UTC, отображение UTC+5.
- Интерфейс — WCAG 2.2 уровня AA, узбекская кириллица как основной язык.
- Пароли и секреты не попадают в репозиторий. Только `.env.example` с пустыми значениями.

## Структура файлов

| Файл | Ответственность |
|---|---|
| `../ruxsatnoma-core/docker-compose.yml` | Локальное окружение: БД, кэш, брокер, объектное хранилище |
| `../ruxsatnoma-core/.env.example` | Перечень переменных без значений |
| `../ruxsatnoma-core/db/00-extensions.sql` | Расширения PostgreSQL |
| `../ruxsatnoma-core/db/01-roles.sql` | Роли и права |
| `../ruxsatnoma-core/db/02-schemas.sql` | Схемы |
| `../ruxsatnoma-core/db/10-nsi.sql` … `db/90-arch.sql` | DDL по схемам, в порядке из `architecture/database.md` раздел 10 |
| `../ruxsatnoma-core/db/test/test_constraints.sql` | Проверка пяти критичных ограничений |
| `../ruxsatnoma-core/.github/workflows/ci.yml` | Линт, тесты, сборка |
| `../ruxsatnoma-frontend/` | Каркас Next.js |
| `migration/legacy-dump-profile.md` | Профиль дампа старой БД |
| `migration/legacy-tariffs.md` | Выгруженные тарифы и сроки |
| `design/design-system.md` | Дизайн-система |

---

## Задача 0.1 — Отправить вопросы Заказчику

**Файлы:**
- Изменить: `qa/questions-to-customer.md`

**Даёт:** запущенный процесс снятия оставшихся блокеров. На 10 августа Заказчику направляются **22 вопроса из 36** — остальные 14 закрыты решениями Исполнителя. Блокеров среди открытых пять: **Б1, Б2, Б3, Б5, Н3**.

> **Текст письма готов** — [`../qa/letters-to-customer.md`](../qa/letters-to-customer.md), письмо 1. Осталось подставить дату, исходящий номер и подпись.

- [ ] **Шаг 1: Решить, на каком языке отправлять**

Документ написан на русском. Заказчик — Агентство по лесам, официальный язык переписки — узбекский. Уточнить у техлида, нужен ли перевод на узбекскую кириллицу. Если нужен — перевести, сохранив нумерацию вопросов без изменений.

- [ ] **Шаг 2: Проставить адресатов и сроки**

В сводной таблице документа у каждого вопроса уже указан адресат. Добавить колонку «Срок ответа» и проставить: блокеры — 5 рабочих дней, остальное — 10.

- [ ] **Шаг 3: Отправить и зафиксировать факт отправки**

Добавить в раздел «История версий» строку с датой отправки и способом.

- [ ] **Шаг 4: Завести регулярную проверку**

Раз в неделю проходить по сводной таблице и переводить отвеченные вопросы в статус «закрыт», вписывая ответ в поле **Ответ**.

---

## Задача 0.2 — Получить дамп действующей базы

**Файлы:**
- Создать: `migration/README.md`

**Даёт:** исходные данные для задач 0.3, 0.4, 0.5 и всей фазы 7.

> **Текст письма готов** — [`../qa/letters-to-customer.md`](../qa/letters-to-customer.md), письмо 2.

- [ ] **Шаг 1: Запросить доступ**

Это вопрос **О2** в файле Заказчику. Нужен дамп продуктивной базы `db_urmonrental`, снятый `pg_dump`. Персональные данные в дампе есть — согласовать порядок хранения и уничтожения копии.

- [ ] **Шаг 2: Проверить целостность дампа**

```bash
pg_restore --list dump.sql | head -50
```

Ожидается: список таблиц с префиксами `accounts_`, `application_`, `payment_`, а также таблицы мобильного приложения, которые нас не касаются.

- [ ] **Шаг 3: Развернуть локально в изолированной базе**

```bash
createdb legacy_ruxsatnoma
psql legacy_ruxsatnoma < dump.sql
```

- [ ] **Шаг 4: Зафиксировать факт и дату снятия дампа**

Записать в `migration/README.md`: дату, размер, кто предоставил, где хранится копия.

---

## Задача 0.3 — Выгрузить тарифы и сроки

**Файлы:**
- Создать: `migration/legacy-tariffs.md`

**Потребляет:** базу `legacy_ruxsatnoma` из задачи 0.2.
**Даёт:** фактические значения коэффициентов — закрывает вопрос **Н2** без обращения к нормативному подразделению.

- [ ] **Шаг 1: Выгрузить строку настроек**

```sql
SELECT bhm,
       legal_application_fee, unlegal_application_fee,
       big_animals_price, middle_animals_price,
       big_sheeps_goats_price, middle_sheeps_goats_price,
       haymaking_price,
       review_period, deadline_receipt, deadline_review,
       deadline_rent_payment, deadline_to_give_permission
FROM application_settings;
```

- [ ] **Шаг 2: Записать результат в документ**

Оформить таблицей: поле, значение, что означает, единица измерения. Все коэффициенты — множители БҲМ, это следует из `help_text` в старой модели.

- [ ] **Шаг 3: Отметить, чего не хватает**

Из формул ТЗ нужны ещё коэффициенты условных голов из приложения 5 к ВМҚ 689-сон и календарь сезонов. В старой системе их **нет** — расчёта норм там не было вовсе. Это остаётся вопросами **Н1** и **Н3**.

- [ ] **Шаг 4: Обновить статус вопроса Н2**

В `qa/questions-to-customer.md` перевести **Н2** в статус «закрыт частично» со ссылкой на выгрузку.

---

## Задача 0.4 — Выгрузить справочник организаций

**Файлы:**
- Создать: `migration/legacy-organizations.md`
- Прочитать: `../ruxsatnoma-old/fixtures/department_accounts.csv`, `../ruxsatnoma-old/fixtures/department_stirs.csv`

**Даёт:** закрывает вопросы **Н5** и **Р5**.

- [ ] **Шаг 1: Сверить фикстуры с продуктивной базой**

```sql
SELECT COUNT(*) FROM department;
SELECT COUNT(*) FROM department_account;
```

В фикстурах по 90 строк. Если в базе больше — фикстуры устарели, брать данные из базы.

- [ ] **Шаг 2: Выгрузить организации с реквизитами**

```sql
SELECT d.id, d.name, d.name_latin, d.stir, d.category, d.management,
       r.name AS region, a.account, a.bank, a.mfo
FROM department d
LEFT JOIN region r ON r.id = d.region_id
LEFT JOIN department_account a ON a.department_id = d.id
ORDER BY r.name, d.name;
```

- [ ] **Шаг 3: Проверить расхождение с ТЗ**

ТЗ говорит про 84 организации, в базе их около 90. Зафиксировать разницу — это вопрос **Р5**.

- [ ] **Шаг 4: Проверить полноту реквизитов**

Организации без расчётного счёта не смогут участвовать в распределении 50 на 50. Выписать список таких отдельно и включить в вопрос **Н5**.

---

## Задача 0.5 — Профилировать дамп

**Файлы:**
- Создать: `migration/legacy-dump-profile.md`

**Даёт:** объёмы и качество данных для планирования фазы 7.

- [ ] **Шаг 1: Посчитать объёмы**

```sql
SELECT 'application' t, COUNT(*) FROM application_application
UNION ALL SELECT 'invoice', COUNT(*) FROM application_invoice
UNION ALL SELECT 'user', COUNT(*) FROM accounts_user
UNION ALL SELECT 'contour', COUNT(*) FROM application_contour
UNION ALL SELECT 'paycom_txn', COUNT(*) FROM payment_paycomtransaction;
```

- [ ] **Шаг 2: Разложить заявки по статусам и типам**

```sql
SELECT type, status, COUNT(*)
FROM application_application
GROUP BY type, status
ORDER BY type, status;
```

Отдельно посчитать заявки типа `hunting` — это вопрос **О9**.

- [ ] **Шаг 3: Найти действующие разрешения**

```sql
SELECT COUNT(*) FROM application_application
WHERE status = 6 AND expire_date >= CURRENT_DATE;
```

Это те, что придётся перенести первыми и заставить работать сразу.

- [ ] **Шаг 4: Найти проблемные записи**

```sql
-- applications without a reason record
SELECT COUNT(*) FROM application_application a
LEFT JOIN application_applicationreason r ON r.application_id = a.id
WHERE r.id IS NULL;

-- non-zero wallet balances, question O11
SELECT COUNT(*), SUM(amount) FROM payment_accountbalance WHERE amount <> 0;

-- applications with no contour
SELECT COUNT(*) FROM application_application WHERE contour_id IS NULL;
```

- [ ] **Шаг 5: Записать всё в документ**

Таблицами, с выводами: сколько строк переносим в каждой фазе миграции, где данные битые, что требует решения Заказчика.

---

## Задача 0.6 — Поднять окружение разработки

**Файлы:**
- Создать: `../ruxsatnoma-core/docker-compose.yml`
- Создать: `../ruxsatnoma-core/.env.example`
- Создать: `../ruxsatnoma-core/.gitignore`

**Даёт:** одинаковое окружение у всех четверых разработчиков.

- [x] **Шаг 1: Написать docker-compose** — выполнено 10 августа

> **Три поправки, найденные при выполнении.** Исходный вариант плана не запускался ни на одной машине команды.
>
> 1. **Образа `postgis/postgis:18-3.6` под arm64 не существует** — официальный образ для PostgreSQL 18 собран только под amd64. Используем `imresamu/postgis:18-3.6`: тот же Dockerfile, мультиархитектурная сборка.
> 2. **PostgreSQL 18 сменил точку монтирования.** Том вешается на `/var/lib/postgresql`, а не на `/var/lib/postgresql/data` — иначе контейнер падает с сообщением про `pg_ctlcluster`.
> 3. **Порты по умолчанию конфликтуют** с другими проектами на машине разработчика. Вынесены в переменные со сдвинутыми значениями по умолчанию.

```yaml
services:
  db:
    # The official postgis/postgis image has no arm64 build for PostgreSQL 18.
    image: imresamu/postgis:18-3.6
    environment:
      POSTGRES_DB: ruxsatnoma_core
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      CORE_PASSWORD: ${CORE_PASSWORD}
      OVERSIGHT_RO_PASSWORD: ${OVERSIGHT_RO_PASSWORD}
      MIGRATOR_PASSWORD: ${MIGRATOR_PASSWORD}
    ports: ["${DB_PORT:-5442}:5432"]
    volumes:
      # PostgreSQL 18 stores data in a major-version subdirectory.
      - pgdata:/var/lib/postgresql
      - ./db:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ruxsatnoma_core"]
      interval: 5s
      retries: 10

  db_integration:
    image: postgres:18
    environment:
      POSTGRES_DB: ruxsatnoma_integration
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports: ["5433:5432"]
    volumes:
      - pgdata_int:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  rabbitmq:
    image: rabbitmq:3-management-alpine
    environment:
      RABBITMQ_DEFAULT_USER: ${MQ_USER}
      RABBITMQ_DEFAULT_PASS: ${MQ_PASSWORD}
    ports: ["5672:5672", "15672:15672"]

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD}
    ports: ["9000:9000", "9001:9001"]
    volumes:
      - miniodata:/data

volumes:
  pgdata:
  pgdata_int:
  miniodata:
```

- [ ] **Шаг 2: Написать `.env.example`**

```
DB_USER=ruxsatnoma
DB_PASSWORD=
MQ_USER=ruxsatnoma
MQ_PASSWORD=
MINIO_USER=ruxsatnoma
MINIO_PASSWORD=
```

- [ ] **Шаг 3: Добавить `.env` в `.gitignore`**

```
.env
*.dump
*.sql.gz
```

- [x] **Шаг 4: Проверить, что всё поднимается** — выполнено 10 августа

```bash
cp .env.example .env   # fill in the passwords
docker compose up -d
docker compose ps
```

Получено: все пять сервисов подняты, четыре из пяти `healthy` (у MinIO healthcheck не задан).

- [x] **Шаг 5: Проверить PostGIS** — выполнено 10 августа

```bash
docker compose exec db psql -U $DB_USER -d ruxsatnoma_core -c "SELECT postgis_version();"
```

Получено: **PostGIS 3.6** (`USE_GEOS=1 USE_PROJ=1 USE_STATS=1`) на **PostgreSQL 18.1**. Расширения `postgis`, `btree_gist`, `pg_trgm`, `pgcrypto` установлены, 11 доменных схем и три роли созданы.

- [ ] **Шаг 6: Коммит**

```bash
git add docker-compose.yml .env.example .gitignore
git commit -m "chore: local development environment"
```

---

## Задача 0.7 — Прогнать DDL на живой базе

**Файлы:**
- Создать: `../ruxsatnoma-core/db/00-extensions.sql` … `db/90-arch.sql`
- Создать: `../ruxsatnoma-core/db/test/test_constraints.sql`
- Изменить: `architecture/database.md` — по результатам

**Потребляет:** окружение из задачи 0.6.
**Даёт:** проверенную схему БД.

> **✅ Выполнена 10 августа 2026.** 17 файлов, 62 таблицы, 268 индексов, 300 ограничений `CHECK`, 122 внешних ключа, 8 `EXCLUDE`, 5 RLS-политик. Накатывается на чистую базу без ошибок, восемь инвариантов зелёные. Результаты и найденные ошибки — [`../architecture/database.md`](../architecture/database.md), раздел 11.

- [x] **Шаг 1: Разложить DDL по файлам**

> **Оказалось не раскладкой, а написанием.** В `database.md` было 5 определений таблиц из 33 сущностей модели данных — документ прямо оговаривает, что приводит «только неочевидные поля». Полный DDL написан по двум источникам: ограничения, индексы и ключевые поля из `database.md`, состав остальных сущностей из [`../tz/11-data-model.md`](../tz/11-data-model.md).
>
> Работа выполнена семью параллельными агентами, по схеме на агента, с единым контрактом внешних ключей, розданным всем заранее. Расхождений в именах не возникло: 50 таблиц, ни одной ссылки на несуществующую.

Нумерация файлов задаёт порядок применения — PostgreSQL в `docker-entrypoint-initdb.d` выполняет их по алфавиту. Два файла добавлены сверх плана: `95-constraints.sql` для внешних ключей, ссылающихся назад по порядку применения, и `96-grants.sql` с `97-rls.sql` для прав и построчной безопасности.

- [ ] **Шаг 2: Написать проверку критичных ограничений**

`db/test/test_constraints.sql`:

```sql
\set ON_ERROR_STOP on

-- 1. A duplicate application must be rejected
BEGIN;
INSERT INTO app.application (id, number, applicant_id, organization_id, territory_code,
                             activity_type, contour_id, period, status)
VALUES (gen_random_uuid(), 'TEST-1', :'applicant', :'org', '01',
        'GRAZING', :'contour', daterange('2026-05-01','2026-09-01'), 'SUBMITTED');

DO $$
BEGIN
    INSERT INTO app.application (id, number, applicant_id, organization_id, territory_code,
                                 activity_type, contour_id, period, status)
    VALUES (gen_random_uuid(), 'TEST-2', :'applicant', :'org', '01',
            'GRAZING', :'contour', daterange('2026-07-01','2026-10-01'), 'SUBMITTED');
    RAISE EXCEPTION 'FAIL: duplicate application was not rejected';
EXCEPTION WHEN exclusion_violation THEN
    RAISE NOTICE 'OK: duplicate rejected';
END $$;
ROLLBACK;

-- 2. Audit log must not be updatable
DO $$
BEGIN
    UPDATE audit.audit_log SET action = 'hacked' WHERE true;
    RAISE EXCEPTION 'FAIL: audit log was updated';
EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'OK: audit log is protected from updates';
END $$;

-- 3. Audit log must not be deletable
DO $$
BEGIN
    DELETE FROM audit.audit_log WHERE true;
    RAISE EXCEPTION 'FAIL: audit log was deleted';
EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'OK: audit log is protected from deletes';
END $$;
```

- [ ] **Шаг 3: Запустить и убедиться, что схема создаётся**

```bash
docker compose down -v && docker compose up -d db
docker compose logs db | grep -i error
```

Ожидается: ни одной ошибки. Если есть — править DDL, а не подавлять.

- [ ] **Шаг 4: Прогнать проверку ограничений**

```bash
docker compose exec db psql -U $DB_USER -d ruxsatnoma_core -f /docker-entrypoint-initdb.d/test/test_constraints.sql
```

Ожидается: три строки `OK:`, ни одного `ПРОВАЛ`.

- [ ] **Шаг 5: Проверить, что `btree_gist` поддерживает `uuid`**

Это единственное место, где я не уверен без запуска. Если exclusion constraint не создался — заменить `applicant_id uuid` на `applicant_id::text` в ограничении либо использовать составной хеш.

- [ ] **Шаг 6: Проверить роль `oversight_ro`**

```sql
SET ROLE oversight_ro;
SELECT COUNT(*) FROM app.application;                    -- must succeed
INSERT INTO app.application DEFAULT VALUES;              -- must fail
RESET ROLE;
```

- [ ] **Шаг 7: Внести исправления в `database.md`**

Всё, что пришлось поправить, отразить в документе и снять из шапки пометку «DDL не выполнялся».

- [ ] **Шаг 8: Коммит**

```bash
git add db/
git commit -m "feat: database schema, verified against a live instance"
```

---

## Задача 0.8 — Завести CI

**Файлы:**
- Создать: `../ruxsatnoma-core/.github/workflows/ci.yml`

**Даёт:** проверку на каждом пуше до того, как в репозитории появится код.

- [ ] **Шаг 1: Написать workflow с проверкой схемы**

```yaml
name: CI
on: [push, pull_request]

jobs:
  schema:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: imresamu/postgis:18-3.6
        env:
          POSTGRES_DB: ruxsatnoma_core
          POSTGRES_USER: ci
          POSTGRES_PASSWORD: ci
        options: >-
          --health-cmd "pg_isready -U ci" --health-interval 5s --health-retries 10
        ports: ["5432:5432"]
    steps:
      - uses: actions/checkout@v4
      - name: Apply schema
        env:
          PGPASSWORD: ci
        run: |
          for f in db/*.sql; do
            echo "=== $f"
            psql -h localhost -U ci -d ruxsatnoma_core -v ON_ERROR_STOP=1 -f "$f"
          done
      - name: Verify constraints
        env:
          PGPASSWORD: ci
        run: psql -h localhost -U ci -d ruxsatnoma_core -v ON_ERROR_STOP=1 -f db/test/test_constraints.sql
```

- [ ] **Шаг 2: Запушить и убедиться, что workflow зелёный**

- [ ] **Шаг 3: Включить обязательную проверку перед слиянием**

В настройках репозитория сделать `schema` обязательной проверкой для веток, вливаемых в `main`.

- [ ] **Шаг 4: Коммит**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: verify database schema on every push"
```

---

## Задача 0.9 — Дизайн-система

**Файлы:**
- Создать: `design/design-system.md`

**Даёт:** основу для всего фронтенда. Дизайна не существует, делаем с нуля.

**Требования ТЗ (п. 4.1.7):** единая дизайн-система во всех модулях, 2–3 основных цвета на модуль, responsive от 1170×768, WCAG 2.2 уровня AA, состояние объясняется не только цветом, но и текстом или иконкой.

- [ ] **Шаг 1: Собрать палитру**

Основной цвет — зелёный, отраслевая принадлежность. Проверить каждую пару «текст на фоне» на контраст не ниже 4.5:1 для обычного текста и 3:1 для крупного — это порог AA.

- [ ] **Шаг 2: Определить типографику**

Шрифт обязан поддерживать узбекскую кириллицу, латиницу и русский. Проверить наличие символов `ў ғ қ ҳ` в выбранном шрифте — многие популярные шрифты их не содержат.

- [ ] **Шаг 3: Определить статусные цвета с текстовым дублированием**

14 статусов заявки и 5 статусов разрешения. У каждого — цвет, иконка и текст. Требование ТЗ: цвет никогда не единственный носитель смысла.

- [ ] **Шаг 4: Описать базовые компоненты**

Кнопка, поле ввода, селект, таблица, карточка, модальное окно, тост, шаги мастера, индикатор загрузки, пустое состояние, сообщение об ошибке.

Для сообщения об ошибке зафиксировать формат из п. 4.1.7: причина, с какими данными связана, как устранить, куда обращаться. Не технический код.

- [x] **Шаг 5: Проверить на реальном экране** — контраст проверен 10 августа

Все пары пересчитаны по формуле WCAG 2.2. **Шесть коэффициентов из восьми в документе были указаны неточно** — расхождения от 0.2 до 0.7. Вердикт при этом не изменился: ни одна пара, несущая смысл, не опускается ниже порога AA. Таблица в [`../design/design-system.md`](../design/design-system.md) приведена к фактическим значениям и дополнена шестью парами, которых в ней не было.

Остаётся проверить на живой странице: навигацию с клавиатуры, видимость фокуса и масштабирование до 200 % без потери информации. Это делается по готовому UI-киту — [`../design/ui-kit/`](../design/ui-kit/).

---

## Задача 0.10 — Каркас фронтенда

> **Исполнитель — FE.** Фронтенд-проект заводит фронтендер сам: структуру, i18n, инструменты и сборку. От техлида он получает дизайн, а не заготовку кода.

**Файлы:**
- Создать: `../ruxsatnoma-frontend/` — структура Next.js

**Потребляет:**
- [`../design/ui-kit/`](../design/ui-kit/README.md) — каркасы кабинета и портала, компоненты, `tokens.css` с готовыми значениями
- [`../design/design-system.md`](../design/design-system.md) — правила и обоснования
- [`../design/screens.md`](../design/screens.md) — что видит каждая из 10 ролей
- [`../design/user-flows.md`](../design/user-flows.md) — по каким экранам идёт человек

- [ ] **Шаг 1: Создать проект**

```bash
npx create-next-app@latest ruxsatnoma-frontend --typescript --app --eslint
```

- [ ] **Шаг 2: Разложить роутинг по трём группам**

```
app/
  (public)/     — SSR, индексируется: главная, тарифы, документы, FAQ, проверка QR
  (cabinet)/    — кабинеты по ролям
  (field)/      — PWA инспектора
```

- [ ] **Шаг 3: Настроить многоязычность**

**Все пять языков входят в первую очередь** — вопрос **О4** закрыт 10 августа: узбекская кириллица, узбекская латиница, русский, каракалпакский, английский. Локали заводятся сразу все пять, а не одна с заделом на расширение.

Узбекская кириллица остаётся языком по умолчанию как государственный. Печатные формы — разрешение, лесной билет, отчёты — формируются на узбекской кириллице независимо от выбранного языка интерфейса: это документы юридической силы.

- [ ] **Шаг 4: Перенести дизайн-систему в токены**

Цвета, типографика, отступы — переменными, а не значениями в компонентах.

- [ ] **Шаг 5: Проверить сборку и линт**

```bash
npm run build && npm run lint
```

- [ ] **Шаг 6: Коммит**

```bash
git add .
git commit -m "chore: frontend skeleton"
```

---

## Задача 0.11 — Согласовать состав первой очереди ✅

**Выполнена 10 августа 2026.** Вопрос **О5** закрыт.

- [x] **Шаг 1: Подготовить обоснование**
- [x] **Шаг 2: Предложить состав первой очереди**
- [x] **Шаг 3: Зафиксировать ответ**

**Первая очередь — выпас скота и сенокошение.** Для них есть утверждённые формы в приложениях 1–3 ТЗ, опыт действующей системы и тарифы в старой базе.

Основание деления изменилось: не срок, а отсутствие утверждённых форм для остальных четырёх видов деятельности — вопрос **П6**, остаётся открытым. Механика системы делается сразу под все шесть видов, состав полей задаётся данными.

Оценка сроков в [`00-roadmap.md`](00-roadmap.md) переписана под назначенную дату завершения — 20 августа 2026, вопрос **Р1**.

---

## Задача 0.12 — Границы модулей внутри `core`

**Файлы:**
- Создать: `architecture/modules.md`

**Потребляет:** схему БД из `architecture/database.md` — схема БД и модуль совпадают один к одному.
**Даёт:** правила, по которым трое бэкендеров работают в одном репозитории и не мешают друг другу. **Обязательное условие старта фазы 1.**

- [ ] **Шаг 1: Зафиксировать список пакетов**

Пакет = схема БД. Одиннадцать доменных пакетов плюс три общих:

```
core/
  api/           REST-контроллеры, middleware
  modules/
    iam/         пользователи, роли, организации, заявители
    geo/         контуры, слои, занятость, тайлы
    rules/       нормы, тарифы, расчёт
    application/ заявка, workflow, SLA
    permit/      разрешение, шаблоны, QR
    signature/   хранение подписей
    payment/     инвойс, сверка, распределение, возврат
    inspection/  акты, нарушения
    reporting/   отчёты, dashboard
    archive/     архив, лесной билет
    prosecutor/  витрина, детекторы риск-индикаторов
  shared/
    audit/       append-only журнал
    outbox/      исходящие события
    classifiers/ справочники НСИ
```

- [ ] **Шаг 2: Описать правила импорта**

Три правила, которые надо сформулировать явно и проверять на ревью:

1. Модуль читает и пишет **только свою схему БД**. Обращение к чужой таблице напрямую запрещено, даже на чтение.
2. Модули общаются через **публичный API модуля** — один файл на входе пакета, всё остальное внутреннее.
3. `shared` может импортировать кто угодно. `shared` не импортирует ни один доменный модуль — иначе получится цикл.

- [ ] **Шаг 3: Нарисовать разрешённые направления зависимостей**

Взять схему 3 из [`../architecture/diagrams.md`](../architecture/diagrams.md) — там уже показано, кто кого вызывает и что передаёт. Перенести в текст как матрицу: строка — кто вызывает, столбец — кого можно вызвать.

- [ ] **Шаг 4: Отметить швы**

`geo` и `payment` помечены как кандидаты на выделение в отдельные сервисы. Для них правило строже: общаться **только** через публичный API, никаких общих транзакций с другими модулями, никаких джойнов через границу пакета в коде.

- [ ] **Шаг 5: Придумать, как это проверять автоматически**

Правила, которые держатся на дисциплине, ломаются на третьей неделе. Нужен линтер импортов в CI — конкретный инструмент зависит от языка, который выберем.

- [ ] **Шаг 6: Раздать зоны ответственности**

Кто владеет какими пакетами — из дорожной карты. Владелец пакета ревьюит все изменения в нём.

---

## Задача 0.13 — Контракты между `core` и `integration`

**Файлы:**
- Создать: `architecture/contracts.md`

**Даёт:** возможность писать `core` и `integration` параллельно, не дожидаясь друг друга. **Обязательное условие старта фазы 1.**

- [ ] **Шаг 1: Описать REST `core` → `integration`**

Для каждого вызова — путь, тело запроса, тело ответа, коды ошибок. Минимум на фазу 1:

```
POST /internal/eimzo/verify      { pkcs7, expected_hash } → { valid, subject, serial, not_after, crl_status, ocsp_status, signed_at }
POST /internal/oneid/exchange    { code, redirect_uri }   → { access_token, profile }
POST /internal/notify            { recipient, channel, template, vars } → { message_id, status }
```

Все ответы при отказе внешней системы — `ERR-INT-001` при timeout, `ERR-INT-002` при ошибке сервиса.

- [ ] **Шаг 2: Описать REST `integration` → `core`**

```
POST /internal/payments/confirm  { invoice_id, provider, external_id, amount, paid_at, idempotency_key }
POST /internal/applications      { application payload from my.gov.uz, idempotency_key }
POST /internal/prosecutor/verify { pinfl } → { verified, position, territory_code, valid_until }
```

- [ ] **Шаг 3: Зафиксировать ключи событий AMQP**

Обменник, ключ маршрутизации, схема тела. Из схемы 0 в диаграммах:

```
events        application.submitted, application.approved, application.rejected,
              permit.issued, permit.revoked,
              payment.invoiced, payment.confirmed, payment.refunded,
              audit.recorded
risk.detected RI-01 … RI-15
notify        notification.requested
dlq           undelivered messages from any queue
```

- [ ] **Шаг 4: Описать интерфейс платёжного адаптера**

Тот самый общий интерфейс, ради которого провайдеры вынесены в `integration`. Четыре метода: создать платёж, разобрать webhook, проверить подпись, привести статус провайдера к нашему. Добавление Payme, Click, Uzum или Paynet — реализация этого интерфейса и запись в конфигурации, без изменений в `core`.

- [ ] **Шаг 5: Зафиксировать сквозные соглашения**

- `Correlation-Id` генерируется в nginx и пробрасывается через все вызовы и события.
- `Idempotency-Key` обязателен на любой операции, меняющей состояние.
- Таймаут синхронного вызова — 10 секунд, дальше очередь.
- Retry — экспоненциальный: 1, 2, 4, 8 минут.

- [ ] **Шаг 6: Выложить контракты как OpenAPI и AsyncAPI**

Требование п. 4.2.9 ТЗ — интеграционные контракты ведутся и версионируются. Markdown для людей, машиночитаемые схемы для генерации клиентов и проверки в CI.

---

## Задача 0.14 — Настроить инструменты

**Файлы:**
- Создать: `../ruxsatnoma-core/pyproject.toml`, `.pre-commit-config.yaml`, `setup.cfg` (для import-linter), `scripts/check_english_only.py`
- То же самое в `../ruxsatnoma-integration/`

**Потребляет:** [`../architecture/engineering-standards.md`](../architecture/engineering-standards.md), разделы 1 и 6.
**Даёт:** проверки, которые не дают правилам развалиться на третьей неделе.

- [ ] **Шаг 1: Собрать `pyproject.toml`**

Взять конфигурацию Ruff, mypy и pytest из раздела 6 стандартов дословно. Правила `DTZ` и `T20` включены намеренно — первое запрещает наивные даты, второе `print`.

- [ ] **Шаг 2: Описать контракты import-linter**

Из [`../architecture/modules.md`](../architecture/modules.md), раздел «Автоматическая проверка». Пока пакетов нет, контракт описывает пустую структуру — но он должен быть в репозитории с первого дня, иначе его никогда не добавят.

- [ ] **Шаг 3: Написать `scripts/check_english_only.py`**

Код приведён в разделе 6 стандартов целиком. Проверить на самом себе:

```bash
python scripts/check_english_only.py scripts/check_english_only.py
```

Ожидается: код возврата 0.

- [ ] **Шаг 4: Проверить, что скрипт ловит нарушение**

```bash
printf '# a comment in Cyrillic: \u043f\u0440\u0438\u0432\u0435\u0442\n' > /tmp/bad.py
python scripts/check_english_only.py /tmp/bad.py; echo "exit code: $?"
```

Ожидается: код возврата 1 и строка с указанием файла.

- [ ] **Шаг 5: Собрать `.pre-commit-config.yaml`**

Ruff, ruff-format, mypy, import-linter, check_english_only. Установить и прогнать на всём репозитории:

```bash
pre-commit install
pre-commit run --all-files
```

- [ ] **Шаг 6: Добавить bandit и pip-audit**

```bash
bandit -r core/ -ll
pip-audit
```

Требование п. 4.1.6.3 ТЗ — проверка базового ПО на известные уязвимости.

- [ ] **Шаг 7: Подключить всё в CI**

Дополнить workflow из задачи 0.8 девятью шагами из раздела 6 стандартов. Ни один не пропускается.

- [ ] **Шаг 8: Коммит**

```bash
git add pyproject.toml .pre-commit-config.yaml setup.cfg scripts/
git commit -m "chore: linting, typing and code standard checks"
```

---

## Задача 0.15 — Тесты-инварианты на ограничения СУБД

> **Исполнитель — B1, владелец `core`.** Тесты пишет тот, кто пишет модели и миграции: это его код, и понимание инвариантов должно остаться у него. См. [`../CLAUDE.md`](../CLAUDE.md), раздел «Разделение труда».
>
> Задача выполняется **после первой миграции Alembic**, а не до неё: тестировать нечего, пока схемы в базе нет.

**Файлы:**
- Создать: `../ruxsatnoma-core/tests/integration/test_schema_invariants.py`
- Уже есть: `../ruxsatnoma-core/tests/conftest.py` — фикстура testcontainers из скелета

**Потребляет:** описание схемы из [`../architecture/database-schema.md`](../architecture/database-schema.md), фикстуру и инструменты из скелета проекта.
**Даёт:** постоянную защиту инвариантов в CI до конца проекта.

**Точный SQL всех ограничений** — в [`../architecture/database-schema.md`](../architecture/database-schema.md), раздел «Ограничения, которые держит база, а не код». Восемь инвариантов проверены на живой базе 10 августа 2026, все прошли; переписать их на pytest значит перенести уже известный результат в постоянную проверку.

**Отдельное предупреждение.** Alembic не видит `EXCLUDE`-ограничения, триггеры и RLS-политики: `autogenerate` их молча пропустит. Первый тест, который нужно написать, — проверка, что после `alembic upgrade head` эти объекты в базе есть. Иначе миграция окажется неполной, а обнаружится это на проде.

- [ ] **Шаг 1: Поднять testcontainers**

`tests/conftest.py` — фикстура, поднимающая `imresamu/postgis:18-3.6` и применяющая миграции Alembic. SQLite не используется: он не умеет ни PostGIS, ни exclusion constraints, ни RLS.

- [ ] **Шаг 2: Написать падающий тест на дубликат заявки**

```python
def test_duplicate_application_is_rejected(db: Connection) -> None:
    """Spec 10.1: only one active application per applicant, contour, activity and period."""
    insert_application(db, period=("2026-05-01", "2026-09-01"), status="SUBMITTED")
    with pytest.raises(ExclusionViolation):
        insert_application(db, period=("2026-07-01", "2026-10-01"), status="SUBMITTED")
```

- [ ] **Шаг 3: Запустить и убедиться, что он падает нужным образом**

```bash
pytest tests/integration/test_schema_invariants.py::test_duplicate_application_is_rejected -v
```

Если тест проходит сразу — значит exclusion constraint не создался. Это ошибка в DDL, а не повод радоваться.

- [ ] **Шаг 4: Дописать остальные четыре инварианта**

Аудит не изменяется, аудит не удаляется, серия и номер разрешения уникальны, активное разрешение обязано иметь валидную геометрию.

- [ ] **Шаг 5: Написать тест на роль прокурора**

```python
def test_prosecutor_role_cannot_write(db_as_oversight_ro: Connection) -> None:
    """Spec appendix 6: read-only is enforced by the database, not by the application."""
    with pytest.raises(InsufficientPrivilege):
        db_as_oversight_ro.execute(text("INSERT INTO app.application DEFAULT VALUES"))
```

- [ ] **Шаг 6: Прогнать всё и убедиться, что зелено**

```bash
pytest tests/integration -v
```

- [ ] **Шаг 7: Коммит**

```bash
git add tests/
git commit -m "test: database-level invariants for schema constraints"
```

---

## Задача 0.16 — Согласовать с Заказчиком график приёмки

**Файлы:**
- Изменить: `qa/questions-to-customer.md` — вопрос **О12**
- Изменить: `plans/schedule-august-2026.md` — по результату

**Даёт:** возможность подписать акт приёмки 20 августа. Появилась из решения техлида о сроке — вопрос **Р1**.

**Почему это отдельная задача.** Опытная эксплуатация занимает от 5 до 15 рабочих дней силами Заказчика (задача 8.2), после неё идут приёмочные испытания. Эти сроки не зависят от того, как быстро мы пишем код. Даже нижняя граница в 5 рабочих дней — это 7 календарных дней, которые обязаны идти **после** готовности системы.

- [ ] **Шаг 1: Посчитать минимально возможный график**

5 рабочих дней опытной эксплуатации плюс 2 дня на испытания и подписание — 7 рабочих дней после готовности системы.

- [ ] **Шаг 2: Направить предложение Заказчику**

> **Текст письма готов** — [`../qa/letters-to-customer.md`](../qa/letters-to-customer.md), письмо 3. Оно самое срочное из трёх: пока график не согласован, дата 20 августа недостижима независимо от скорости разработки.

Просить нижнюю границу: опытная эксплуатация с 13 августа, приёмочные испытания 19–20 августа, комиссия собрана заранее. Оформить как вопрос **О12** в файле Заказчику.

- [ ] **Шаг 3: Зафиксировать ответ и пересчитать дату**

Если Заказчик не готов начать 13 августа, дата подписания акта определяется его календарём, а не нашим темпом. Записать фактическую дату в [`00-roadmap.md`](00-roadmap.md) и [`schedule-august-2026.md`](schedule-august-2026.md).

---

## Готово, когда

- [ ] Вопросы отправлены Заказчику, назначены ответственные и сроки
- [ ] График приёмки согласован с Заказчиком — задача 0.16
- [ ] Дамп старой базы получен и развёрнут локально
- [ ] Тарифы, сроки и справочник организаций выгружены в `migration/`
- [ ] Профиль дампа записан: объёмы, действующие разрешения, битые записи
- [ ] `docker compose up -d` поднимает окружение одной командой
- [ ] DDL накатывается на пустую базу без ошибок, три проверки ограничений проходят
- [ ] CI проверяет схему на каждом пуше
- [ ] Дизайн-система описана, контраст проверен инструментом
- [ ] Каркас фронтенда собирается, заведены пять локалей
- [x] Состав первой очереди согласован — задача 0.11, вопрос **О5** закрыт
- [x] `architecture/modules.md` написан — границы модулей и правила импорта
- [x] `architecture/contracts.md` написан — контракты между сервисами
- [ ] Инструменты настроены, `pre-commit run --all-files` проходит
- [ ] Тесты-инварианты написаны и зелёные в CI

## Сроки

Фаза 0 целиком укладывается в **10–11 августа** — два первых дня расписания [`schedule-august-2026.md`](schedule-august-2026.md). Исходная оценка составляла 3–4 недели.

## Следующая фаза

[`00-roadmap.md`](00-roadmap.md), фаза 1 «Фундамент» — начинается 11 августа, детальный план уже написан: [`phase-1-foundation.md`](phase-1-foundation.md).
