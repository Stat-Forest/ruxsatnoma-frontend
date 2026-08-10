# Фаза 2 — GIS и правила

> **Для агентов:** используйте `superpowers:subagent-driven-development` или `superpowers:executing-plans`. Шаги отмечены чекбоксами `- [ ]`.

**Цель:** GIS-специалист заводит контур, нормативный специалист заводит норму, система считает `MaxSB` и `RemainingSB` за пять секунд.

**Архитектура:** два модуля в `core` — `geo` владеет геометрией и занятостью, `rules` владеет нормами и тарифами. `rules` вызывает `geo`, обратной зависимости нет.

**Стек:** PostGIS 3.6, GeoAlchemy2, Shapely, GDAL для импорта, `pg_tileserv` или `ST_AsMVT` для тайлов.

## Предусловия

Фаза 1 завершена: каркас `core`, аудит, outbox, IAM, RBAC и ABAC работают.

## ⚠️ Блокеры

Эта фаза зависит от Заказчика сильнее всех остальных.

| Блокер | Что без него |
|---|---|
| **Б1** — цифровые контуры | Задачи 2.1–2.6 пишутся, но наполнять нечем |
| **Б2** — геоботанические исследования | Задача 2.7 без данных для норм |
| **Н1** — коэффициенты условных голов | **Задача 2.8 не может быть завершена** |
| **Н3** — календарь сезонов и ротации | Задача 2.8 неполна |
| **О8** — система координат | Влияет на SRID во всей схеме `geo` |

**Порядок при отсутствии ответов.** Задачи 2.1–2.6 выполняются полностью: редактор и импорт контуров позволят Заказчику вводить данные самому, а это ускорит ответ на **Б1** лучше любых писем. Задача 2.8 пишется с коэффициентами, вынесенными в справочник — тогда подстановка реальных значений не потребует изменений в коде.

## Структура файлов

| Файл | Ответственность |
|---|---|
| `core/modules/geo/models.py` | `Layer`, `Contour`, `ContourVersion`, `Occupancy` |
| `core/modules/geo/lifecycle.py` | Переходы `Draft → Review → Approved → Published → Archived` |
| `core/modules/geo/topology.py` | `ST_IsValid`, `ST_Within`, `ST_Overlaps`, `ST_Area` |
| `core/modules/geo/import_.py` | Разбор SHP, GeoJSON, KML, KMZ, GPKG, CSV, ZIP |
| `core/modules/geo/occupancy.py` | Резервирование и расчёт свободной площади |
| `core/modules/geo/tiles.py` | Генерация vector tiles |
| `core/modules/rules/formulas.py` | Формулы ВМҚ 689 и ВМҚ 278 |
| `core/modules/rules/models.py` | `Norm`, `Tariff`, `SeasonCalendar`, `RotationPlan`, `BhmHistory` |
| `core/modules/rules/service.py` | Расчёт лимита и суммы |
| `integration/adapters/kadastr.py`, `vet.py` | Внешние проверки |

## Порядок

```
2.1 схема geo ──┬─ 2.2 жизненный цикл ──> 2.3 импорт
                ├─ 2.4 топология
                ├─ 2.5 занятость ─────────┐
                └─ 2.6 тайлы              │
                                          ▼
2.7 схема rules ── 2.8 формулы 689 ── 2.11 расчёт лимита
                └─ 2.9 формулы 278
                └─ 2.10 версионирование

2.12 адаптеры Кадастра и Ветеринарии — параллельно, Backend 3
2.13 фронтенд карты — отстаёт на задачу
```

---

## Задача 2.1 — Схема `geo`

**Кто:** Backend 2
**Produces:** `geo.get_contour(id)`, `geo.list_contours(filters)`, `geo.get_layer(code)`

- [ ] **Шаг 1: Тест — невалидная геометрия не сохраняется**

```python
async def test_invalid_geometry_is_rejected(session: AsyncSession) -> None:
    self_intersecting = "POLYGON((0 0, 2 2, 2 0, 0 2, 0 0))"

    with pytest.raises(IntegrityError):
        await session.execute(
            insert(Contour).values(geometry=func.ST_GeomFromText(self_intersecting, 4326))
        )
```

Проверка стоит на уровне СУБД — `CHECK (ST_IsValid(geometry))`. Если тест проходит без реализации, значит constraint из задачи 0.7 не создался.

- [ ] **Шаг 2: Тест — SRID фиксирован**

```python
async def test_wrong_srid_is_rejected(session: AsyncSession) -> None:
    with pytest.raises(DataError):
        await session.execute(
            insert(Contour).values(geometry=func.ST_GeomFromText("POLYGON((0 0,1 0,1 1,0 0))", 3857))
        )
```

SRID зависит от ответа на **О8**. До ответа берём `4326` и выносим в настройку — смена значения не должна требовать правки кода.

- [ ] **Шаг 3: Реализовать модели**

13 слоёв из модуля 10.2 ТЗ: лесной фонд, граница организации, контур, пастбище, сенокос, пчёлы, рекреация, ограничение, охрана, ротация, отдых, водная точка, скотопрогон.

- [ ] **Шаг 4: Пространственные индексы**

```sql
CREATE INDEX contour_geom_gix ON geo.contour USING gist (geometry);
```

- [ ] **Шаг 5: Тест — публичный API не отдаёт объекты SQLAlchemy**

```python
def test_public_api_returns_plain_types() -> None:
    contour = geo.get_contour(some_id)
    assert not isinstance(contour, DeclarativeBase)
```

Это требование из [`../architecture/modules.md`](../architecture/modules.md): `geo` помечен как кандидат на выделение в сервис, поэтому наружу выходят только простые типы.

- [ ] **Шаг 6: Коммит**

```bash
git commit -m "feat(geo): spatial schema with layers, contours and versions"
```

---

## Задача 2.2 — Жизненный цикл контура

**Кто:** Backend 2
**Consumes:** 2.1
**Produces:** `geo.transition(contour_id, to_state, approval_doc_id)`

Сценарий **С17**.

- [ ] **Шаг 1: Тест — без подтверждающего документа в `Published` не переводится**

Требование п. 17.3 сценария С17.

```python
async def test_publish_requires_approval_document(session: AsyncSession) -> None:
    contour = await create_contour(session, status="APPROVED")

    with pytest.raises(ApprovalDocumentRequired) as error:
        await geo.transition(session, contour.id, "PUBLISHED", approval_doc_id=None)

    assert error.value.code == "ERR-GIS-005"
```

- [ ] **Шаг 2: Запустить, убедиться что падает**

- [ ] **Шаг 3: Реализовать переходы**

`Draft → Review → Approved → Published → Archived`. Недопустимые переходы поднимают исключение — тест на каждый.

- [ ] **Шаг 4: Тест — изменение контура архивирует старую версию**

Требование п. 17.4: привязанные разрешения остаются на старой версии.

```python
async def test_editing_contour_archives_previous_version(session: AsyncSession) -> None:
    contour = await create_published_contour(session)
    permit = await issue_permit(session, contour_version_id=contour.version_id)

    await geo.update_geometry(session, contour.id, new_geometry)

    assert (await reload(permit)).contour_version_id == contour.version_id
    assert (await get_version(session, contour.version_id)).status == "ARCHIVED"
```

- [ ] **Шаг 5: Реализовать версионирование**

Атрибуты версии: `source`, `accuracy`, `survey_date`, `effective_from`, `effective_to`, `approval_doc_id`.

- [ ] **Шаг 6: Каждый переход пишет аудит и событие**

- [ ] **Шаг 7: Коммит**

---

## Задача 2.3 — Импорт геометрии

**Кто:** Backend 2
**Consumes:** 2.1
**Produces:** `geo.import_file(file, layer_code) -> ImportResult`

Семь форматов: SHP, GeoJSON, KML, KMZ, GPKG, CSV, ZIP.

- [ ] **Шаг 1: Тест — ошибка в файле откатывает весь импорт**

Требование п. 17.1 сценария С17.

```python
async def test_import_rolls_back_on_error(session: AsyncSession) -> None:
    file = build_geojson(valid_features=5, invalid_at_index=3)

    result = await geo.import_file(session, file, layer_code="CONTOUR")

    assert result.status == "FAILED"
    assert result.errors[0].row == 3
    assert result.errors[0].code == "ERR-GIS-004"
    assert await count_contours(session) == 0
```

Частичный импорт недопустим: три контура из пяти хуже, чем ноль, потому что непонятно, каких не хватает.

- [ ] **Шаг 2: Запустить, убедиться что падает**

- [ ] **Шаг 3: Реализовать чтение форматов через GDAL**

- [ ] **Шаг 4: Тест — error report содержит номер строки и тип ошибки**

- [ ] **Шаг 5: Тест — крупный файл обрабатывается асинхронно**

Требование п. 17: импорт крупного файла выполняется асинхронно с уведомлением о результате. Порог — от 1000 объектов.

- [ ] **Шаг 6: Коммит**

---

## Задача 2.4 — Проверки топологии

**Кто:** Backend 2
**Consumes:** 2.1
**Produces:** `geo.validate_geometry(geom, contour_id) -> GeometryVerdict`

- [ ] **Шаг 1: Тест — геометрия вне лесного фонда отклоняется**

```python
async def test_geometry_outside_forest_fund_is_rejected(session: AsyncSession) -> None:
    outside = polygon_outside_forest_fund()

    verdict = await geo.validate_geometry(session, outside)

    assert not verdict.valid
    assert verdict.code == "ERR-GIS-002"
```

- [ ] **Шаг 2: Тест — пересечение со слоем ограничений**

`ERR-GIS-003`, отказ `RJ-08`.

- [ ] **Шаг 3: Тест — пересечение со слоем охраны**

- [ ] **Шаг 4: Тест — самопересекающаяся геометрия**

`ERR-GIS-001`.

- [ ] **Шаг 5: Реализовать все четыре проверки одним запросом**

Не четырьмя запросами подряд — требование по времени ≤ 3 секунд на GIS-операцию.

- [ ] **Шаг 6: Коммит**

---

## Задача 2.5 — Занятость контура

**Кто:** Backend 2
**Consumes:** 2.1, 2.4
**Produces:** `geo.get_available_area(contour_id, period) -> AvailableArea`, `geo.reserve(...)`, `geo.release(...)`

Ядро проверки лимита. Формула из п. 4.3.1: `S_available = S_total − S_active_overlap`.

- [ ] **Шаг 1: Тест — свободная площадь уменьшается на занятую**

```python
async def test_available_area_excludes_active_occupancy(session: AsyncSession) -> None:
    contour = await create_contour(session, area_ha=Decimal("100.0000"))
    await geo.reserve(session, contour.id, half_of(contour.geometry),
                      period=("2026-05-01", "2026-09-01"))

    available = await geo.get_available_area(
        session, contour.id, period=("2026-06-01", "2026-08-01")
    )

    assert available.total_ha == Decimal("100.0000")
    assert available.occupied_ha == Decimal("50.0000")
    assert available.available_ha == Decimal("50.0000")
```

- [ ] **Шаг 2: Тест — непересекающийся период не уменьшает площадь**

```python
async def test_non_overlapping_period_does_not_reduce_area(session: AsyncSession) -> None:
    contour = await create_contour(session, area_ha=Decimal("100.0000"))
    await geo.reserve(session, contour.id, half_of(contour.geometry),
                      period=("2026-01-01", "2026-03-01"))

    available = await geo.get_available_area(
        session, contour.id, period=("2026-06-01", "2026-08-01")
    )

    assert available.available_ha == Decimal("100.0000")
```

- [ ] **Шаг 3: Тест — двойной учёт устраняется**

Прямое требование п. 4.3.1: «устраняется double-count». Два перекрывающихся занятия не должны считаться дважды.

```python
async def test_overlapping_occupancies_are_not_double_counted(session: AsyncSession) -> None:
    contour = await create_contour(session, area_ha=Decimal("100.0000"))
    await geo.reserve(session, contour.id, first_60_percent(contour.geometry), period=P)
    await geo.reserve(session, contour.id, last_60_percent(contour.geometry), period=P)

    available = await geo.get_available_area(session, contour.id, period=P)

    assert available.occupied_ha == Decimal("100.0000")   # not 120
```

Реализуется через `ST_Union`, а не через сумму площадей. Тест ловит самую вероятную ошибку в этой задаче.

- [ ] **Шаг 4: Реализовать расчёт**

SQL — [`../architecture/database.md`](../architecture/database.md), раздел 4.2.

- [ ] **Шаг 5: Тест на гонку**

Две параллельные заявки на один контур. Должна пройти одна.

```python
async def test_concurrent_reservations_do_not_oversubscribe() -> None:
    results = await asyncio.gather(
        reserve_almost_all(contour_id), reserve_almost_all(contour_id),
        return_exceptions=True,
    )
    successes = [r for r in results if not isinstance(r, Exception)]
    assert len(successes) == 1
```

Закрывается `pg_advisory_xact_lock` по `contour_id`.

- [ ] **Шаг 6: Тест на время**

```python
async def test_availability_check_completes_within_sla(session: AsyncSession) -> None:
    contour = await create_contour_with_occupancies(session, count=200)

    start = time.perf_counter()
    await geo.get_available_area(session, contour.id, period=P)

    assert time.perf_counter() - start < 5.0
```

Требование п. 4.1.4 — проверка overlap ≤ 5 секунд.

- [ ] **Шаг 7: Коммит**

```bash
git commit -m "feat(geo): contour occupancy with union-based area calculation"
```

---

## Задача 2.6 — Vector tiles

**Кто:** Backend 2
**Produces:** `GET /api/v1/layers/{layer}/tiles/{z}/{x}/{y}.pbf`

- [ ] **Шаг 1: Тест — тайл возвращается и содержит объекты**
- [ ] **Шаг 2: Тест — отображение укладывается в 3 секунды**
- [ ] **Шаг 3: Реализовать через `ST_AsMVT`**
- [ ] **Шаг 4: Кэш в Redis, инвалидация при изменении контура**
- [ ] **Шаг 5: Коммит**

---

## Задача 2.7 — Схема `rules`

**Кто:** Backend 2
**Produces:** `rules.get_published_norm(contour_id, activity, on_date)`, `rules.get_tariff(activity, on_date)`

- [ ] **Шаг 1: Тест — норма без подтверждающего документа не публикуется**

Требование п. 18.1 сценария С18, аналогично контуру.

- [ ] **Шаг 2: Тест — на дату возвращается действовавшая версия**

```python
async def test_norm_lookup_respects_effective_period(session: AsyncSession) -> None:
    await create_norm(session, contour_id=C, effective=("2025-01-01", "2025-12-31"), max_sb=20)
    await create_norm(session, contour_id=C, effective=("2026-01-01", None), max_sb=25)

    old = await rules.get_published_norm(session, C, "GRAZING", date(2025, 6, 1))
    new = await rules.get_published_norm(session, C, "GRAZING", date(2026, 6, 1))

    assert old.max_sb == 20
    assert new.max_sb == 25
```

- [ ] **Шаг 3: Реализовать модели и версионирование**
- [ ] **Шаг 4: История БҲМ отдельной таблицей**
- [ ] **Шаг 5: Календари сезона, ротации и отдыха**

Значения зависят от **Н3** — структура делается, данные подставляются позже.

- [ ] **Шаг 6: Коммит**

---

## Задача 2.8 — Формулы ВМҚ 689

**Кто:** Backend 2
**Consumes:** 2.7
**Produces:** `rules.calculate_max_sb(...)`, `rules.calculate_used_sb(livestock)`

⚠️ **Блокируется вопросом Н1** — числовых коэффициентов условных голов нет.

- [ ] **Шаг 1: Тест на цепочку расчёта нормы**

```python
def test_max_sb_follows_vmq_689() -> None:
    result = calculate_max_sb(
        yield_c_per_ha=Decimal("12.0"),
        area_ha=Decimal("100.0"),
        season_share=Decimal("0.5"),
    )

    # oz     = 12.0 * 100.0 * 0.5 = 600.0
    # oz_eff = 600.0 * 0.85       = 510.0
    # max_sb = floor(510.0 / 3.74) = 136
    assert result == SbLoad(Decimal("136"))
```

- [ ] **Шаг 2: Запустить, убедиться что падает**

- [ ] **Шаг 3: Реализовать формулу**

```python
INSURANCE_RESERVE = Decimal("0.85")   # VMQ 689: 15% insurance reserve
FEED_UNIT_PER_HEAD = Decimal("3.74")  # VMQ 689: centners of feed units


def calculate_max_sb(
    yield_c_per_ha: Decimal, area_ha: Decimal, season_share: Decimal
) -> SbLoad:
    """Maximum conditional head load for a contour. See spec section 4.3.1."""
    oz = yield_c_per_ha * area_ha * season_share
    oz_eff = oz * INSURANCE_RESERVE
    return SbLoad((oz_eff / FEED_UNIT_PER_HEAD).to_integral_value(ROUND_FLOOR))
```

- [ ] **Шаг 4: Тест на округление**

`floor`, а не банковское округление. Тест на граничные значения: `3.739`, `3.74`, `3.741`.

- [ ] **Шаг 5: Тест — `UsedSB` считается по 12 группам скота**

Коэффициенты берутся из справочника `nsi`, а не зашиваются в код:

```python
def test_used_sb_sums_by_coefficient(coefficients: dict[str, Decimal]) -> None:
    livestock = {"cattle_adult": 10, "sheep_over_6m": 50}

    result = calculate_used_sb(livestock, coefficients)

    expected = 10 * coefficients["cattle_adult"] + 50 * coefficients["sheep_over_6m"]
    assert result == SbLoad(expected)
```

Тест не зависит от конкретных значений — он проверяет формулу. Когда придут реальные коэффициенты по **Н1**, менять код не придётся.

- [ ] **Шаг 6: Завести коэффициенты как справочник с версионированием**

- [ ] **Шаг 7: Коммит**

```bash
git commit -m "feat(rules): VMQ 689 norm and load formulas with coefficient registry"
```

---

## Задача 2.9 — Формулы ВМҚ 278

**Кто:** Backend 2
**Produces:** `rules.calculate_amount(...)`, `rules.calculate_refund(...)`

⚠️ **Блокируется вопросом Н2** частично — БҲМ и коэффициенты выгружаются из старой базы задачей 0.3, льготные категории требуют **Н4**.

- [ ] **Шаг 1: Тест на сумму платежа**

```python
def test_amount_follows_vmq_278() -> None:
    result = calculate_amount(
        bhm=Money(Decimal("340000.00")),
        coefficient=Decimal("0.5"),
        quantity=Decimal("10"),
    )
    assert result == Money(Decimal("1700000.00"))
```

- [ ] **Шаг 2: Тест на округление до двух знаков**

Прямое требование п. 4.3.1: decimal-арифметика с явной политикой округления. Проверить, что `int()` нигде не используется — старая система теряла копейки именно так.

- [ ] **Шаг 3: Тест на возврат**

```python
def test_refund_is_proportional_to_unused_period() -> None:
    result = calculate_refund(
        paid=Money(Decimal("1200000.00")),
        unused_days=60,
        paid_days=120,
    )
    assert result == Money(Decimal("600000.00"))
```

- [ ] **Шаг 4: Тест на распределение 50 на 50**

```python
def test_allocation_splits_evenly() -> None:
    parts = calculate_allocation(Money(Decimal("1000000.01")))
    assert sum(p.amount for p in parts) == Decimal("1000000.01")
```

Тест на нечётную копейку: сумма долей обязана равняться исходной сумме. Классическое место потери денег при делении.

- [ ] **Шаг 5: Реализовать, прогнать**
- [ ] **Шаг 6: Льготный коэффициент**

Структура делается, категории по **Н4**.

- [ ] **Шаг 7: Коммит**

---

## Задача 2.10 — Версионирование и защита от ретроактивных изменений

**Кто:** Backend 2
**Consumes:** 2.7, 2.8, 2.9

- [ ] **Шаг 1: Тест — ретроактивное изменение требует maker-checker**

```python
async def test_retroactive_tariff_change_requires_second_approval(session) -> None:
    with pytest.raises(MakerCheckerRequired):
        await rules.publish_tariff(
            session, effective_from=date(2025, 1, 1), approved_by=None
        )
```

- [ ] **Шаг 2: Тест — ретроактивное изменение порождает `RI-04`**

- [ ] **Шаг 3: Тест — выданные разрешения не пересчитываются**

Требование п. 18.3 сценария С18.

```python
async def test_norm_change_does_not_affect_issued_permits(session) -> None:
    permit = await issue_permit(session, amount=Money(Decimal("1000000.00")))
    await rules.publish_tariff(session, coefficient=Decimal("2.0"))

    assert (await reload(permit)).amount == Money(Decimal("1000000.00"))
```

- [ ] **Шаг 4: Реализовать, прогнать**
- [ ] **Шаг 5: Коммит**

---

## Задача 2.11 — Расчёт лимита

**Кто:** Backend 2
**Consumes:** 2.5, 2.8
**Produces:** `rules.check_limit(contour_id, activity, period, livestock) -> LimitVerdict`

Точка, где сходится вся фаза.

- [ ] **Шаг 1: Тест — превышение лимита возвращает остаток и максимум**

```python
async def test_limit_exceeded_reports_remaining_and_maximum(session) -> None:
    verdict = await rules.check_limit(
        session, contour_id=C, activity="GRAZING", period=P,
        livestock={"cattle_adult": 100},
    )

    assert not verdict.within_limit
    assert verdict.code == "ERR-NORM-002"
    assert verdict.remaining_sb == SbLoad(Decimal("18.50"))
    assert verdict.max_allowed_heads == 15
```

Требование п. 3.3 сценария С3: система показывает остаточный лимит и максимально возможное поголовье. Не просто «превышено».

- [ ] **Шаг 2: Тест — отсутствие нормы даёт `ERR-NORM-001`**

Плюс в ответе — ответственная организация, требование п. 3.1.

- [ ] **Шаг 3: Тест — несоответствие календарю даёт `ERR-NORM-003`**

Плюс разрешённый период, требование п. 3.6.

- [ ] **Шаг 4: Реализовать `check_limit`**

Последовательность: `geo.get_available_area` → `rules.get_published_norm` → `MaxSB` → `ActivePermitsSB` → `RemainingSB` → `UsedSB` → сравнение.

- [ ] **Шаг 5: Тест — результат сохраняется с `rule_version` и `input_snapshot`**

- [ ] **Шаг 6: Тест на время: полный расчёт ≤ 5 секунд**

- [ ] **Шаг 7: Коммит**

```bash
git commit -m "feat(rules): limit check combining occupancy, norm and tariff"
```

---

## Задача 2.12 — Адаптеры Кадастра и Ветеринарии

**Кто:** Backend 3
**Consumes:** каркас `integration` из 1.6

⚠️ **Блокируется вопросом Б5** — соглашений о взаимодействии нет.

- [ ] **Шаг 1: Тесты на заглушках по контракту из [`../architecture/contracts.md`](../architecture/contracts.md)**
- [ ] **Шаг 2: Тест — недоступность возвращает `ERR-INT-001`**
- [ ] **Шаг 3: Тест — отрицательный ответ Ветеринарии ведёт к `RJ-10`**
- [ ] **Шаг 4: Реализовать адаптеры**
- [ ] **Шаг 5: Проверить на sandbox, если он есть (вопрос О3)**
- [ ] **Шаг 6: Коммит**

---

## Задача 2.13 — Фронтенд: карта

**Кто:** Frontend
**Consumes:** 2.3, 2.4, 2.6

Экран «Карта — редактор» из [`../design/screens.md`](../design/screens.md).

- [ ] **Шаг 1: Отображение слоёв через vector tiles**
- [ ] **Шаг 2: Рисование и правка геометрии**
- [ ] **Шаг 3: Измерение расстояния и площади**
- [ ] **Шаг 4: Импорт файла с показом error report**
- [ ] **Шаг 5: Состояние конфликта — пересечение с подсветкой и объяснением**
- [ ] **Шаг 6: Карточка контура**
- [ ] **Шаг 7: Экспорт карты в PDF и PNG**
- [ ] **Шаг 8: Коммит**

---

## Готово, когда

- [ ] GIS-специалист рисует контур на карте и импортирует из файла
- [ ] Ошибка в файле откатывает импорт целиком с error report
- [ ] Контур не переводится в `Published` без подтверждающего документа
- [ ] Изменение контура архивирует версию, разрешения остаются на старой
- [ ] Геометрия вне лесфонда, с самопересечением или в охранной зоне отклоняется
- [ ] Свободная площадь считается через объединение геометрий без двойного учёта
- [ ] Две параллельные заявки на один контур не проходят обе
- [ ] Нормативный специалист заводит норму, система считает `MaxSB` по ВМҚ 689
- [ ] Сумма считается по ВМҚ 278 в decimal без потери копеек
- [ ] Распределение 50 на 50 не теряет копейку на нечётной сумме
- [ ] Ретроактивное изменение требует maker-checker и порождает `RI-04`
- [ ] Изменение нормы не пересчитывает выданные разрешения
- [ ] Проверка лимита возвращает остаток и максимально возможное поголовье
- [ ] Полная проверка укладывается в 5 секунд на контуре с 200 занятиями
- [ ] Карта отображается за 3 секунды

## Следующая фаза

[`phase-3-application-and-permit.md`](phase-3-application-and-permit.md)
