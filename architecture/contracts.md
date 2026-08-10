# Контракты между `core` и `integration`

Эти два сервиса пишут разные люди параллельно. Контракт — единственное, о чём они договариваются заранее.

Схема потоков — [`diagrams.md`](diagrams.md), схемы 0 и 2. Границы модулей — [`modules.md`](modules.md).

## Сквозные соглашения

Действуют на каждом вызове и каждом событии.

| Соглашение | Правило |
|---|---|
| **`Correlation-Id`** | Генерируется в nginx (`$request_id`), пробрасывается через все вызовы, события и записи аудита. По нему собирается вся цепочка одного действия |
| **`Idempotency-Key`** | Обязателен на любой операции, меняющей состояние. Повторный вызов с тем же ключом возвращает результат первого, не выполняя действие второй раз |
| **Таймаут синхронного вызова** | 10 секунд. Дальше — очередь и `ERR-INT-001` |
| **Retry** | Экспоненциальный: 1, 2, 4, 8 минут. После исчерпания попыток — DLQ и предупреждение администратору |
| **Формат ошибки** | `{ "code": "ERR-INT-001", "message": "...", "correlation_id": "..." }`. Коды — из приложения 8 ТЗ, [`../tz/14-errors-classifiers.md`](../tz/14-errors-classifiers.md) |
| **Время** | Только ISO 8601 с зоной: `2026-09-15T10:30:00+05:00` |
| **Деньги** | Строкой с двумя знаками: `"1250000.00"`. Никогда числом с плавающей точкой — при сериализации в JSON теряется точность |
| **Версионирование** | Путь начинается с `/internal/v1/`. Ломающее изменение — новая версия, старая живёт до перевода всех потребителей |

---

## REST: `core` → `integration`

Внутренние вызовы, наружу не публикуются. Аутентификация — mTLS между сервисами.

### Проверка электронной подписи

```
POST /internal/v1/eimzo/verify
{
  "pkcs7": "MIIH...",
  "expected_hash": "sha256:9f86d081...",
  "correlation_id": "018f2c..."
}
→ 200
{
  "valid": true,
  "subject": "МУХИТДИНОВ ЭРКИН МАХМУДОВИЧ",
  "pinfl": "31234567890123",
  "serial": "5A3F...",
  "not_before": "2026-01-15T00:00:00+05:00",
  "not_after": "2027-01-15T00:00:00+05:00",
  "crl_status": "GOOD",
  "ocsp_status": "GOOD",
  "signed_at": "2026-09-15T10:30:00+05:00"
}
```

Сервис **не хранит** результат. Хранение сущности `signature` — задача модуля `signature` в `core` (см. [`modules.md`](modules.md)).

Отказ: `ERR-AUTH-004`, если сертификат просрочен или отозван. `ERR-SIGN-001`, если подпись не сходится с `expected_hash`.

### Обмен кода OneID на профиль

```
POST /internal/v1/oneid/exchange
{ "code": "abc123", "redirect_uri": "https://ruxsatnoma-urmon.uz/auth/callback" }
→ 200
{
  "access_token": "...",
  "profile": {
    "pinfl": "31234567890123",
    "tin": "123456789",
    "full_name": "...",
    "birth_date": "1985-01-01",
    "passport": "AA1234567",
    "region_code": "10",
    "district_code": "1027"
  }
}
```

### Данные Кадастра по контуру

```
POST /internal/v1/kadastr/contour
{ "contour_id": "018f2c...", "geometry": { "type": "MultiPolygon", "coordinates": [...] } }
→ 200
{ "legal_status": "FOREST_FUND", "owner": "...", "restrictions": ["PROTECTED_ZONE"], "source_date": "2026-03-01" }
```

При недоступности — `ERR-INT-001`. `core` в этом случае формирует задание GIS-специалисту и применяет maker-checker (сценарий С5, п. 5.2).

### Проверка в Ветеринарной АТ

```
POST /internal/v1/vet/check
{ "applicant_pinfl": "31234567890123", "livestock": { "cattle_adult": 12, "sheep_over_6m": 40 } }
→ 200
{ "verified": true, "declared_total": 52, "vet_status": "CLEAR", "checked_at": "..." }
```

Отрицательный ответ ведёт к отказу `RJ-10`.

### Отправка уведомления

```
POST /internal/v1/notify
{
  "recipient": { "user_id": "018f2c...", "phone": "+998901234567", "email": "..." },
  "channels": ["IN_APP", "SMS"],
  "template": "application.submitted",
  "language": "uz-Cyrl",
  "vars": { "application_number": "А-00042" },
  "mandatory": true,
  "idempotency_key": "notify-018f2c-submitted"
}
→ 202
{ "message_id": "018f2d...", "status": "QUEUED" }
```

`mandatory: true` — юридически значимое уведомление. Доставляется через in-app **даже если пользователь отключил канал** (требование п. 4.2.8).

### Верификация прокурора

```
POST /internal/v1/prosecutor/verify
{ "pinfl": "31234567890123" }
→ 200
{
  "verified": true,
  "position": "прокурор района",
  "territory_code": "1027",
  "territory_scope": "DISTRICT",
  "valid_until": "2027-06-30"
}
```

`territory_scope` принимает значения `DISTRICT`, `REGION`, `REPUBLIC`. При `REPUBLIC` территориальное ограничение не применяется.

**Ответ запрещено кэшировать** — требование п. 4.2.11.1. `integration` не хранит его ни в Redis, ни в памяти. При недоступности «Raqamli nazorat» возвращается `ERR-AUTH-005`, и вход прокурору не даётся.

---

## REST: `integration` → `core`

### Подтверждение платежа

```
POST /internal/v1/payments/confirm
{
  "invoice_id": "018f2c...",
  "provider": "PAYME",
  "external_id": "5f8a3b2c1d",
  "amount": "1250000.00",
  "paid_at": "2026-09-15T10:30:00+05:00",
  "idempotency_key": "payme-5f8a3b2c1d"
}
→ 200
{ "invoice_status": "PAID", "application_status": "PAID" }
```

Единственный путь, которым в системе появляется статус `PAID`. KPI из ТЗ — ноль случаев ручной установки. Повторный вызов с тем же `idempotency_key` возвращает тот же ответ, не меняя состояния.

### Заявка из my.gov.uz

```
POST /internal/v1/applications
{
  "channel": "MYGOV",
  "applicant": { "pinfl": "...", "tin": null },
  "activity_type": "GRAZING",
  "contour_id": "018f2c...",
  "period": { "from": "2026-05-01", "to": "2026-09-01" },
  "livestock": { "cattle_adult": 12, "sheep_over_6m": 40 },
  "idempotency_key": "mygov-req-77123"
}
→ 201
{ "application_id": "018f2e...", "number": "А-00042", "status": "SUBMITTED", "amount": "1250000.00" }
→ 409  { "code": "ERR-APP-002", "existing_application_number": "А-00031" }
→ 422  { "code": "ERR-NORM-002", "remaining_sb": "18.50", "max_allowed_heads": 15 }
```

Требование AC-01 из ТЗ: **при одинаковом входе оба канала возвращают одинаковый расчёт, статус и `application_id`**. Поэтому обработчик тот же самый, что для портала, — отличается только поле `channel`.

### Приём ответа от внешней системы в очереди

Когда синхронный вызов ушёл в таймаут и был поставлен в очередь, ответ возвращается асинхронно:

```
POST /internal/v1/integration/callback
{ "correlation_id": "018f2c...", "request_type": "vet.check", "status": "SUCCESS", "payload": {...} }
```

---

## События AMQP

Обменник типа `topic`, имя `ruxsatnoma`. Тело — JSON. Публикация только через outbox, в той же транзакции, что и действие.

| Ключ маршрутизации | Когда | Кто читает |
|---|---|---|
| `application.submitted` | Заявка подписана и отправлена | Raqamli nazorat, уведомления |
| `application.approved` | Руководитель утвердил | Raqamli nazorat, уведомления |
| `application.rejected` | Отказ с кодом `RJ-*` | Raqamli nazorat, уведомления |
| `application.returned` | Возврат на исправление | Уведомления |
| `permit.issued` | Разрешение подписано | Raqamli nazorat, уведомления, my.gov.uz |
| `permit.suspended` | Приостановлено | Raqamli nazorat, уведомления |
| `permit.revoked` | Аннулировано | Raqamli nazorat, уведомления |
| `payment.invoiced` | Инвойс сформирован | Уведомления, my.gov.uz |
| `payment.confirmed` | Платёж подтверждён провайдером | Raqamli nazorat, уведомления |
| `payment.refunded` | Возврат выполнен | Raqamli nazorat, уведомления |
| `norm.published` | Норма или тариф переведены в Published | Raqamli nazorat |
| `audit.recorded` | Юридически значимое действие | Raqamli nazorat |
| `risk.detected` | Сработал детектор `RI-01`…`RI-15` | Raqamli nazorat, dashboard |
| `notification.requested` | Требуется уведомление | Воркер уведомлений |

### Общая часть тела события

```json
{
  "event_id": "018f2c...",
  "occurred_at": "2026-09-15T10:30:00+05:00",
  "correlation_id": "018f2c...",
  "idempotency_key": "...",
  "actor": { "user_id": "...", "role": "ORG_HEAD", "pinfl": "..." },
  "territory_code": "1027",
  "object": { "type": "application", "id": "018f2e..." },
  "payload": {}
}
```

`territory_code` присутствует в каждом событии — по нему «Raqamli nazorat» распределяет данные между прокуратурами.

### Очередь недоставленных

Ключ `dlq.*`. Попадает всё, что не ушло после исчерпания попыток. По каждому сообщению администратору отправляется предупреждение, он может переотправить вручную (сценарий С26, п. 6).

---

## Интерфейс платёжного адаптера

Тот самый общий интерфейс, ради которого провайдеры вынесены в `integration`. Добавление пятого провайдера — реализация этого интерфейса и запись в конфигурации. Изменений в `core` при этом ноль.

```python
class PaymentAdapter(Protocol):
    """Common contract for every payment provider.

    Adding a provider means implementing this protocol and adding a config row.
    No changes in `core` are required.
    """

    provider_code: str  # PAYME | CLICK | UZUM | PAYNET

    def create_payment(self, invoice: InvoiceData) -> PaymentLink:
        """Create a payment at the provider. Returns a link or form payload."""

    def parse_webhook(self, headers: dict[str, str], body: bytes) -> WebhookEvent:
        """Parse an incoming webhook into our unified structure."""

    def verify_signature(self, headers: dict[str, str], body: bytes) -> bool:
        """Verify the provider signature. False means 401 and no processing."""

    def map_status(self, provider_status: str) -> PaymentStatus:
        """Map a provider status onto ours.

        Target values: CREATED | PENDING | PAID | FAILED | CANCELLED | REFUNDED.
        """
```

### Что обязан обеспечить каждый адаптер

1. **Проверка подписи до любой обработки.** Неподписанный webhook отбрасывается, событие пишется в аудит.
2. **Идемпотентность.** Ключ — `provider_code + external_id`. Повторный webhook не создаёт вторую транзакцию.
3. **Сверка суммы.** Если пришедшая сумма не равна сумме инвойса — `ERR-PAY-003`, статус `PAID` не ставится, формируется расхождение для бухгалтера.
4. **Никакой бизнес-логики.** Адаптер переводит формат провайдера в наш и всё. Решение о смене статуса заявки принимает `core`.

### Конфигурация провайдера

```
adapter.provider_config
    provider_code   PAYME
    is_enabled      true
    endpoint        https://checkout.paycom.uz
    merchant_id     ...
    secret_ref      vault://payme/secret     ← ссылка, не значение
    priority        10                        ← порядок в списке способов оплаты
```

Секреты в базе не хранятся — только ссылка на хранилище.

---

## Что публикуется наружу

Всё выше — внутренние контракты. Наружу смотрят три группы эндпоинтов:

| Путь | Кто вызывает | Аутентификация |
|---|---|---|
| `/api/*` | Фронтенд | JWT, выданный `core` |
| `/webhooks/{provider}` | Payme, Click, Uzum, Paynet | Подпись провайдера |
| `/bff/*` | my.gov.uz | mTLS + подпись |

Для них ведутся **OpenAPI** для REST и **AsyncAPI** для событий, с версионированием — требование п. 4.2.9 ТЗ. Markdown этого файла — для людей, машиночитаемые схемы генерируются из кода и проверяются в CI.

---

## Как менять контракт

1. Добавление необязательного поля — не ломающее изменение, версия не меняется.
2. Удаление поля, изменение типа, изменение семантики — ломающее. Новая версия пути, старая живёт, пока есть потребители.
3. Новый ключ маршрутизации событий — не ломающее. Потребители подписаны на префиксы.
4. Любое изменение — сначала в этом файле и в схеме OpenAPI/AsyncAPI, потом в коде. Иначе второй сервис узнает об изменении из падения тестов.
