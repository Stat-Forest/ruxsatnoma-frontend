# Инженерные стандарты

Язык — **Python**. Решение принято 8 августа 2026, закрывает вопрос **Р4** к Заказчику.

Документ описывает, как мы пишем код: подход к предметной области, принципы, инструменты, тесты. Границы модулей — в [`modules.md`](modules.md), контракты — в [`contracts.md`](contracts.md).

---

## 1. Стек

| Что | Чем | Почему именно так |
|---|---|---|
| Веб-фреймворк | **FastAPI** | Асинхронность нужна для 12 внешних интеграций; Pydantic даёт валидацию из коробки; OpenAPI генерируется автоматически — требование п. 4.2.9 ТЗ |
| ORM | **SQLAlchemy 2.0** + **GeoAlchemy2** | Единственный зрелый способ работать с PostGIS из Python. Типизированный стиль 2.0, без legacy Query API |
| Миграции | **Alembic** | Стандарт для SQLAlchemy. Каждая миграция обратима |
| Валидация | **Pydantic v2** | Одна модель на границе API и на границе адаптера |
| Линтер и форматтер | **Ruff** | Заменяет flake8, isort, black, pyupgrade и часть pylint одним инструментом. Быстрый настолько, что не мешает |
| Типы | **mypy** в строгом режиме | Домен без типов на таком объёме правил превращается в кашу |
| Границы модулей | **import-linter** | Правила из `modules.md`, проверяемые машиной |
| Тесты | **pytest** + `pytest-asyncio` + `pytest-cov` | — |
| Тестовая БД | **testcontainers** с образом `imresamu/postgis:18-3.6` | SQLite не умеет ни PostGIS, ни exclusion constraints — тестировать на нём бессмысленно. Образ мультиархитектурный: у официального `postgis/postgis` нет сборки под arm64 для PostgreSQL 18 |
| Логи | **structlog** | Структурный JSON с `correlation_id` в каждой строке |
| Безопасность | **bandit**, **pip-audit** | П. 4.1.6.3 ТЗ требует проверки базового ПО на известные уязвимости |
| Хуки | **pre-commit** | Чтобы CI не был первым, кто узнаёт о проблеме |
| Задачи по расписанию | **APScheduler** в `core-worker` | Регламентные задания из ТЗ: истёкшие разрешения, сверка, архивация |
| Очереди | **aio-pika** | Асинхронный клиент RabbitMQ |

---

## 2. Domain-Driven Design — что берём и что не берём

DDD применяем выборочно. Полный набор паттернов на четырёхмесячном проекте втроём — это оверинжиниринг, то есть нарушение KISS из того же списка принципов.

### Берём

**Единый язык.** Это здесь не теория. ТЗ на узбекском, команда говорит по-русски, код на английском. Без словаря соответствий через месяц половина кода будет называть одно и то же тремя способами.

| Узбекский (ТЗ) | Русский | Код |
|---|---|---|
| ариза | заявка | `Application` |
| рухсатнома | разрешение | `Permit` |
| контур | контур | `Contour` |
| фойдаланиш меъёри | норма пользования | `Norm` |
| шартли бош (СБ) | условная голова | `SbLoad` |
| ижрочи ходим | сотрудник-исполнитель | `Executor` |
| ваколатли шахс | уполномоченное лицо | `Approver` |
| далолатнома | акт инспекции | `InspectionAct` |
| қоидабузарлик | нарушение | `ViolationCase` |
| ўрмон чиптаси | лесной билет | `ForestTicket` |
| БҲМ | базовая расчётная величина | `BaseUnit` |
| тақсимот | распределение | `Allocation` |

Полный словарь — в [`../tz/00-glossary.md`](../tz/00-glossary.md).

Первые две колонки нужны для разговора и документации. **В код попадает только третья.** Русский и узбекский в именах, комментариях и строках кода не появляются — см. раздел 7.

**Агрегаты и транзакционные границы.** Правило: одна транзакция изменяет один агрегат.

| Агрегат | Корень | Что внутри |
|---|---|---|
| Заявка | `Application` | `Calculation`, `ApplicationDocument`, история статусов |
| Разрешение | `Permit` | `Signature`, `ForestTicket` |
| Контур | `Contour` | `ContourVersion` |
| Норма | `Norm` | — |
| Инвойс | `Invoice` | `PaymentIntent`, `ProviderTransaction` |
| Акт инспекции | `InspectionAct` | `Media` |
| Дело о нарушении | `ViolationCase` | — |

Ссылки между агрегатами — **только по идентификатору**, не по объекту. `Application` хранит `contour_id`, а не объект `Contour`. Это то же правило, что «модуль не лезет в чужую схему», выраженное на уровне кода.

**Одно задокументированное исключение.** Проверка занятости контура и создание заявки идут в одной транзакции — иначе две заявки одновременно пройдут проверку. Здесь мы сознательно трогаем два агрегата. Записано в [`modules.md`](modules.md) и здесь, чтобы это не выглядело недосмотром.

**Объекты-значения.** Не примитивы там, где примитив уже приводил к ошибкам:

```python
@dataclass(frozen=True)
class Money:
    """Monetary amount. Always Decimal, never float."""

    amount: Decimal
    currency: str = "UZS"

    def __post_init__(self) -> None:
        if self.amount.as_tuple().exponent < -2:
            raise ValueError("Money must not have more than two decimal places")


@dataclass(frozen=True)
class SbLoad:
    """Conditional livestock head load. Defined by resolution VMQ 689."""

    value: Decimal


@dataclass(frozen=True)
class Pinfl:
    """Personal identification number of an individual (PINFL / JSHSHIR)."""

    value: str

    def __post_init__(self) -> None:
        if not (len(self.value) == 14 and self.value.isdigit()):
            raise ValueError("PINFL must be exactly 14 digits")
```

`Money` существует потому, что старая система считала деньги через `int()` и отбрасывала копейки — см. [`../tz/20-legacy-code-audit.md`](../tz/20-legacy-code-audit.md), п. 6.4. Тип, который физически не даёт положить туда `float`, надёжнее договорённости.

**Доменные события.** Уже есть — это `outbox`. Событие публикуется в той же транзакции, что и изменение агрегата.

**Ограниченные контексты** — это наши модули. Совпадают со схемами БД.

### Не берём

| Паттерн | Почему нет |
|---|---|
| **Event sourcing** | Даёт полную историю изменений. У нас для этого есть append-only аудит, которого ТЗ и требует. Событийное хранилище добавит сложности, не решив ни одной задачи из ТЗ |
| **CQRS с отдельной моделью чтения** | Обсуждали для витрины прокурора и отказались — читаем напрямую с фильтром по территории. Отдельная проекция дала бы задержку и код синхронизации без выигрыша |
| **Отдельный слой Application Services** поверх доменных | На нашем объёме это лишний уровень перекладывания. Один `service.py` на модуль |
| **Anti-corruption layer** как отдельный слой | Его роль уже выполняет `integration` — он и есть перевод из чужих форматов в наши |
| **Repository как абстракция над несколькими СУБД** | У нас одна СУБД и она не поменяется. Репозиторий — просто место, где живут запросы, а не слой переносимости |

---

## 3. SOLID — где именно применяется

Не абстрактно, а с местом в нашем коде.

**S — единственная ответственность.** Пакет = схема БД. Файл = одна роль: `models.py` описывает таблицы, `repository.py` делает запросы, `service.py` содержит правила, `state_machine.py` знает переходы. Если файл перевалил за 400 строк — скорее всего, в нём две ответственности.

**O — открыт для расширения, закрыт для изменения.** Главный пример — платёжный адаптер. Добавление Click или Uzum это новый класс, реализующий `PaymentAdapter`, и строка в конфигурации. Ни одного изменения в `core`. Второй пример — детекторы риск-индикаторов: `RI-16` добавляется новым классом, а не правкой существующего.

**L — подстановка.** Все реализации `PaymentAdapter` взаимозаменяемы: `core` не знает, какой провайдер обслуживает платёж. Адаптер не имеет права требовать особой обработки на своей стороне.

**I — разделение интерфейсов.** Публичный API модуля узкий и говорит доменными терминами. Наружу не выставляются объекты SQLAlchemy — только Pydantic-модели или dataclass-и:

```python
# core/modules/geo/__init__.py
def get_available_area(contour_id: UUID, period: DateRange) -> AvailableArea: ...
def validate_geometry(geom: Geometry) -> GeometryVerdict: ...
```

Ни `Session`, ни `Contour` из `models.py` наружу не уходят. Иначе шов для выделения `geo` в сервис зарастает в первый же месяц.

**D — инверсия зависимостей.** Доменная логика не импортирует FastAPI и SQLAlchemy. Репозиторий объявляется протоколом в домене, реализуется в инфраструктуре:

```python
class NormRepository(Protocol):
    def find_published(self, contour_id: UUID, activity: ActivityType, on_date: date) -> Norm | None: ...
```

Тогда расчёт нормы тестируется без базы — а формул из ВМҚ 689 и 278 много, и тесты на них должны быть быстрыми.

---

## 4. DRY и KISS — с оговорками

**DRY.** Одно знание живёт в одном месте. Но абстрагировать по второму совпадению рано — правило трёх: увидел третье повторение, тогда обобщай. Преждевременная абстракция дороже дублирования, потому что её приходится разбирать обратно.

Что дублировать **нельзя** ни при каких условиях:

- Формулы расчёта — только в `rules`, ни строчки в других модулях
- Правила переходов статусов — только в `state_machine.py`
- Коды ошибок `ERR-*` и причин отказа `RJ-*` — только в справочнике
- Правила доступа — только в middleware ABAC

**KISS.** Проверка простая: если решение нельзя объяснить новому человеку за пять минут, оно скорее всего сложнее задачи.

Конкретно для этого проекта:

- Не вводим абстракций, которых нет в ТЗ. Нет требования менять СУБД — нет слоя переносимости.
- Не пишем свой оркестратор, планировщик или брокер. Есть RabbitMQ и APScheduler.
- Не делаем микросервисов больше, чем решили. Два бэкенда, и решение обосновано.
- Не оптимизируем до замера. Требования по времени из ТЗ конкретны — сначала измеряем, потом чиним.

**YAGNI.** В ТЗ есть раздел «перспективы развития»: искусственный интеллект, предиктивная аналитика, спутниковые снимки. Это перспективы, а не требования. Не закладываемся под них — закладываемся под то, что они когда-нибудь появятся, а это разные вещи.

---

## 5. Тесты

### Пирамида

| Уровень | Что покрывает | Где | Скорость |
|---|---|---|---|
| **Модульные** | Формулы, статус-машина, объекты-значения, правила доступа | Без БД, чистые функции | миллисекунды |
| **Интеграционные** | Репозитории, ограничения СУБД, PostGIS, RLS | Реальный PostgreSQL + PostGIS через testcontainers | секунды |
| **Контрактные** | Соответствие `core` и `integration` контрактам из `contracts.md` | Схемы OpenAPI и AsyncAPI | секунды |
| **Сквозные** | Критичные сценарии: С3, С9–С11, С22 | Поднятое окружение | минуты |

**SQLite не используем нигде.** Он не умеет PostGIS, exclusion constraints, RLS и партиционирование — то есть ровно то, на чём держатся наши инварианты.

### Что обязано быть покрыто на 100 %

Не покрытие ради цифры, а конкретные места, где ошибка стоит дорого:

1. **Все формулы из п. 4.3.1 ТЗ** — `Oz`, `Oz_eff`, `MaxSB`, `UsedSB`, `RemainingSB`, сумма платежа, возврат, распределение. С проверкой округления и граничных значений.
2. **Статус-машина заявки** — каждый допустимый переход и, что важнее, **каждый недопустимый**.
3. **Пять критичных ограничений СУБД** из [`database.md`](database.md) — тест обязан пытаться их нарушить и получать отказ.
4. **Роль прокурора** — тест, который под ролью `oversight_ro` делает `POST`, `PUT`, `DELETE` и убеждается, что получает `403`, а на уровне базы — отказ прав.
5. **Идемпотентность** — повторный webhook, повторная заявка из my.gov.uz.

### Тесты-инварианты

Отдельная группа. Проверяют не поведение функции, а свойство системы:

```python
def test_paid_status_only_from_verified_webhook(db: Session) -> None:
    """Spec KPI: zero PAID statuses without a provider confirmation."""
    invoice = create_invoice(db)
    with pytest.raises(DomainError, match="ERR-PAY-001"):
        invoice_service.mark_paid(invoice.id, source="manual")


def test_audit_log_cannot_be_modified(db: Session) -> None:
    """Spec 4.2.4: not even an administrator may alter the audit log."""
    entry = audit.write(db, action="test")
    with pytest.raises(InsufficientPrivilege):
        db.execute(
            text("UPDATE audit.audit_log SET action = 'x' WHERE id = :id"),
            {"id": entry.id},
        )


def test_norm_change_does_not_recalculate_issued_permits(db: Session) -> None:
    """Spec 4.2.10: issued permits stay bound to their own rule_version."""
    permit = issue_permit(db, amount=Money(Decimal("1000000.00")))
    publish_new_tariff(db, coefficient=Decimal("2.0"))
    assert reload(permit).amount == Money(Decimal("1000000.00"))
```

### TDD

Порядок: падающий тест → минимальная реализация → зелёный тест → рефакторинг → коммит. Для формул и статус-машины это не пожелание, а требование — там цена ошибки выражается в деньгах и в отказах гражданам.

---

## 6. Конфигурация инструментов

### `pyproject.toml`

```toml
[tool.ruff]
line-length = 100
target-version = "py313"

[tool.ruff.lint]
select = ["E", "F", "W", "I", "N", "UP", "B", "A", "C4", "DTZ", "T20", "SIM", "RUF"]
ignore = ["E501"]

[tool.ruff.lint.per-file-ignores]
"tests/*" = ["S101"]

[tool.mypy]
python_version = "3.13"
strict = true
warn_unreachable = true
plugins = ["pydantic.mypy"]

[[tool.mypy.overrides]]
module = "tests.*"
disallow_untyped_defs = false

[tool.pytest.ini_options]
addopts = "-q --strict-markers --cov=core --cov-report=term-missing"
markers = [
    "integration: requires a running database",
    "e2e: requires the full environment",
]
```

Правило `DTZ` в Ruff включено намеренно — оно запрещает `datetime.now()` без временной зоны. У нас всё время `timestamptz`, и наивные даты недопустимы.

Правило `T20` запрещает `print` — в старой системе отладочные `print` в обработчиках ошибок остались в проде.

### `pre-commit`

```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    hooks: [{id: ruff, args: [--fix]}, {id: ruff-format}]
  - repo: https://github.com/pre-commit/mirrors-mypy
    hooks: [{id: mypy, additional_dependencies: [pydantic, sqlalchemy]}]
  - repo: local
    hooks:
      - id: import-linter
        name: module boundaries
        entry: lint-imports
        language: system
        pass_filenames: false
      - id: english-only
        name: source code must be English only
        entry: scripts/check_english_only.py
        language: python
        types: [python]
```

### Проверка «в коде только английский»

Правило из раздела 7 проверяется машиной, а не на ревью. `scripts/check_english_only.py`:

```python
#!/usr/bin/env python3
"""Fail if non-Latin characters appear anywhere in the source tree.

User-facing text belongs in locale files, never in the source. See the
engineering standards, section 7.
"""

import re
import sys
from pathlib import Path

# Cyrillic and Cyrillic Supplement, written as escapes on purpose: spelling the
# range with literal Cyrillic characters would make this file fail its own check.
NON_LATIN = re.compile(r"[\u0400-\u04ff\u0500-\u052f]")
EXCLUDED = ("locales/", "tests/fixtures/")


def main(paths: list[str]) -> int:
    failures: list[str] = []
    for raw in paths:
        path = Path(raw)
        if any(part in str(path) for part in EXCLUDED):
            continue
        for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if NON_LATIN.search(line):
                failures.append(f"{path}:{number}: {line.strip()[:80]}")
    for failure in failures:
        print(failure, file=sys.stderr)
    if failures:
        print(
            f"\n{len(failures)} line(s) contain non-Latin characters. "
            "Move user-facing text to locales/.",
            file=sys.stderr,
        )
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
```

### Что проверяет CI

1. `ruff check` и `ruff format --check`
2. `mypy` в строгом режиме
3. `lint-imports` — границы модулей из [`modules.md`](modules.md)
4. `check_english_only.py` — в коде нет кириллицы
5. `pytest` — модульные и интеграционные
6. Схема БД накатывается на чистую базу
7. Проверка пяти критичных ограничений
8. `bandit` и `pip-audit` — уязвимости
9. Сборка образов

Ни один шаг не пропускается. Красный CI — код не вливается.

---

## 7. Соглашения по коду

### Всё в коде — на английском

Правило без исключений. Английские: имена переменных, функций, классов, модулей, файлов и веток; комментарии; docstring-и; имена и docstring-и тестов; тексты технических исключений; сообщения коммитов; названия миграций; ключи в логах; имена таблиц и колонок в БД; описания в конфигурационных файлах.

Ни русского, ни узбекского в коде нет. Русский остаётся языком документации и обсуждений, узбекский — языком ТЗ и интерфейса для пользователя.

**Единственное исключение — тексты, которые видит пользователь.** Они по ТЗ обязаны быть на государственном языке, но в коде их нет: они живут в файлах локализации и подставляются по ключу.

```python
# GOOD: code is English, user-facing text comes from a locale key
raise NormNotPublished(message_key="errors.norm.not_published", contour_id=contour_id)

# BAD: user-facing text hardcoded in the source
raise NormNotPublished("Танланган контурда тасдиқланган норма йўқ")
```

Локализация: `locales/uz-Cyrl/errors.json`, `locales/ru/errors.json` и так далее. Ключи — английские, значения — на языке пользователя.

### Именование

Из единого языка (раздел 2). `Application`, а не `Request`. `Permit`, а не `License`. Если сущность есть в ТЗ, её английское имя берётся из [`../tz/11-data-model.md`](../tz/11-data-model.md), а не изобретается.

### Комментарии и docstring-и

На английском, объясняют «почему», а не «что». Где код реализует требование ТЗ — обязательна ссылка на пункт или нормативный акт:

```python
# VMQ 689: a 15% insurance reserve is deducted before head count is derived
oz_eff = oz * Decimal("0.85")

def calculate_max_sb(yield_c_per_ha: Decimal, area_ha: Decimal, season_share: Decimal) -> SbLoad:
    """Calculate the maximum conditional head load for a contour.

    Formula from resolution VMQ 689, see spec section 4.3.1:
        oz     = yield * area * season_share
        oz_eff = oz * 0.85          # 15% insurance reserve
        max_sb = floor(oz_eff / 3.74)
    """
```

Названия узбекских нормативных актов транслитерируются: `VMQ 689`, `VMQ 278`, `VMQ 506`, `PF-204`. Кириллицей в коде их не пишем.

### Исключения

Доменные, с кодом из приложения 8 ТЗ. Текст — технический, на английском, для разработчика. Пользователь его не видит.

```python
class DomainError(Exception):
    code: str
    message_key: str


class NormNotPublished(DomainError):
    code = "ERR-NORM-001"
    message_key = "errors.norm.not_published"
```

Middleware переводит их в HTTP-ответ и подставляет локализованный текст по `message_key`. В коде модулей `HTTPException` не используется — иначе домен привязывается к FastAPI.

### Прочее

**Асинхронность.** Всё, что ходит по сети, — асинхронное. Всё, что считает, — обычные функции. Не делать `async` там, где нет ввода-вывода.

**Логи.** `structlog`, JSON, английские ключи, обязательные поля `correlation_id`, `user_id`, `module`. Персональные данные в логи не пишутся — требование закона «О персональных данных», на который ссылается ТЗ.

**Миграции.** Одна миграция — одно изменение. Обратимая. Данные и структура — разными миграциями. Название файла на английском: `2026_09_15_add_application_exclusion_constraint.py`.

---

## 8. Коммиты и ветки

Conventional Commits, **полностью на английском**:

```
feat(rules): calculate MaxSB per VMQ 689 formulas
fix(payment): repeated webhook created a second transaction
test(app): reject duplicate application via exclusion constraint
docs(architecture): document module boundaries
```

Ветка на задачу плана: `feat/2.8-vmq-689-formulas`. Слияние в `main` — через pull request с зелёным CI и ревью владельца пакета (владельцы — в [`modules.md`](modules.md)).

Описание pull request может быть на русском — его читают люди, а не инструменты.

---

## 9. Что делать при конфликте принципов

Принципы иногда противоречат друг другу. Порядок приоритетов сверху вниз:

1. **Требование ТЗ.** Если ТЗ требует constraint на уровне СУБД, мы делаем его, даже если это выглядит избыточно.
2. **Корректность денег и юридически значимых операций.** Здесь не экономим ни на типах, ни на тестах.
3. **Понятность.** Код читают чаще, чем пишут, а команда маленькая.
4. **DRY, паттерны, красота.**

То есть при выборе между «красиво» и «понятно» выбираем понятно. Между «понятно» и «правильно считает деньги» — правильно считает деньги.
