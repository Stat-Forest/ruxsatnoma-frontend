# Модель данных

Приложение 7 оригинала — «Основные сущности». 33 сущности.

## Сущности

| Сущность | Основные атрибуты | Связи |
|---|---|---|
| `user` | `user_id`, ЖШШИР, Ф. И. О., должность, организация, роль, территория, статус | → `organization`, `role` |
| `role` | `role_id`, название, список функций, критерии назначения | → `permission` |
| `organization` | `org_id`, название, тип, территория, СТИР, вышестоящая организация | → `organization` (иерархия) |
| `applicant` | `applicant_id`, тип (физ./юр. лицо), ЖШШИР/СТИР, реквизиты | → `user` |
| `application` | `application_id`, `applicant_id`, `activity_type`, `contour_id`, период, количество, статус, канал, SLA | → `contour`, `norm`, `contract`, `permit` |
| `contour` | `contour_id`, `geometry`, слой, территория, версия, `source`, `accuracy`, `effective_from/to`, `approval_doc_id`, статус | → `organization` |
| `norm` | `norm_id`, `contour_id`, `activity_type`, `yield`, `season`, `rotation`, `MaxSB`, `rule_version`, статус | → `contour` |
| `tariff` | `tariff_id`, `activity_type`, коэффициент, БҲМ, `effective_from/to` | — |
| `calculation` | `calc_id`, `application_id`, `rule_version`, `input_snapshot`, `UsedSB`, `RemainingSB`, `amount` | → `application` |
| `invoice` | `invoice_id`, `application_id`, сумма, статус, срок | → `application` |
| `payment_intent` | `intent_id`, `invoice_id`, провайдер, статус, `idempotency_key` | → `invoice` |
| `provider_transaction` | `txn_id`, `intent_id`, внешний ID, сумма, время, статус | → `payment_intent` |
| `bank_statement` | `statement_id`, дата, список транзакций | — |
| `reconciliation` | `rec_id`, `txn_id`, `statement_id`, результат, расхождение, примечание | → `provider_transaction` |
| `allocation` | `alloc_id`, `txn_id`, получатель, сумма, расчётный счёт | → `provider_transaction` |
| `refund` | `refund_id`, `application_id`, основание, формула, сумма, статус, SLA | → `application` |
| `permit` | `permit_id`, `application_id`, серия, номер, ID файла PDF/A, QR, статус, срок действия | → `application`, **`contract`** |
| `signature` | `sign_id`, тип и ID объекта, подписант, сертификат, `timestamp`, `hash`, результат | → `permit`, **`contract`**, `application` |
| `inspection_act` | `act_id`, `permit_id`, инспектор, GPS, чек-лист, факт, статус, подпись | → `permit` |
| `media` | `media_id`, тип и ID объекта, файл, время, GPS, устройство, `hash` | → `inspection_act` |
| `violation_case` | `case_id`, `act_id`, тип, решение, ущерб, статус | → `inspection_act` |
| `forest_ticket` | `ticket_id`, `application_id`, номер, срок действия, ограничения | → `application` |
| `notification` | `notif_id`, получатель, канал, шаблон, статус, время | → `user` |
| `audit_log` | `log_id`, пользователь, действие, объект, старое/новое значение, IP, устройство, время | → все объекты |
| `risk_indicator` | `ri_id`, код, объект, уровень, время, состояние передачи | → `audit_log` |
| `oversight_event` | `event_id`, тип, объект, время, состояние передачи, `correlation_id` | → `audit_log` |
| `report_form` | `form_id`, название, тип, столбцы, период, статус | — |
| `report` | `report_id`, `form_id`, организация, период, данные, статус, подпись | → `report_form` |
| `classifier` | `classifier_id`, тип, код, название, срок действия, статус | — |
| `archive_item` | `archive_id`, тип и ID объекта, срок хранения, `hash`, расположение | → все документы |

> ⚠️ **Пробел ТЗ.** Сущность **`contract`** упоминается дважды — в связях `permit` и `signature` — но **сама в перечне отсутствует**. Это согласуется с отсутствующим модулем 10.4 и сценарием С7. См. [18-gaps-and-open-questions.md](18-gaps-and-open-questions.md).

---

## Группировка по доменам

Модель разбита по функциональным зонам — полезно при определении границ сервисов и схем БД.

### Идентификация и организации
`user`, `role`, `organization`, `applicant`

### Пространственные данные
`contour`

### Правила и расчёт
`norm`, `tariff`, `calculation`

### Заявка и разрешение
`application`, ~~`contract`~~ ⚠️, `permit`, `forest_ticket`, `signature`

### Платежи
`invoice`, `payment_intent`, `provider_transaction`, `bank_statement`, `reconciliation`, `allocation`, `refund`

### Инспекция и нарушения
`inspection_act`, `media`, `violation_case`

### Отчётность
`report_form`, `report`

### Сквозные
`notification`, `audit_log`, `risk_indicator`, `oversight_event`, `classifier`, `archive_item`

---

## Ограничения, вытекающие из других разделов ТЗ

Эти ограничения не перечислены в приложении 7, но требуются в других пунктах и должны попасть в схему БД.

| Ограничение | Источник | Реализация |
|---|---|---|
| **Одна активная заявка** по `applicant_id + contour_id + activity_type` с пересекающимся периодом | п. 4.2.10 (10.1), сценарий С3 п. 7 | Exclusion constraint на уровне СУБД (`EXCLUDE USING gist` по `tstzrange`) — ТЗ прямо требует «через constraint СУБД» |
| **Неповторяемость серии и номера** разрешения | Сценарий С11 п. 2 | Unique constraint; ТЗ: «гарантируется на уровне СУБД» |
| **Валидная геометрия** у активного разрешения | KPI: 100 % | `CHECK (ST_IsValid(geometry))` + `NOT NULL contour_id` |
| **Append-only аудит** | п. 4.2.4 | Отзыв прав `UPDATE`/`DELETE` на таблице `audit_log`, даже у администратора |
| **Read-only для роли «Прокурор»** | Приложение 6 | Отдельный пользователь СУБД + view'ы без `INSERT`/`UPDATE`/`DELETE` |
| **Версионирование** нормы, тарифа, контура, шаблона документа | пп. 4.2.10, 4.2.15 | Поля `effective_from` / `effective_to` + `rule_version`; historical rows не удаляются |
| **Immutable snapshot** подписанного документа | п. 4.2.10 (10.6) | Отдельное хранение + `hash`; запрет изменения после подписания |
| Хранение **input snapshot** каждого расчёта | п. 4.3.1 | `calculation.input_snapshot` (JSONB) |
| Метки времени в **UTC+5** | п. 4.3.6 | `timestamptz`, единый источник NTP |

## Требования к БД (п. 4.3.2.4)

- реляционное хранение и работа на основе запросов на современных языках БД;
- использование СУБД с кроссплатформенными решениями;
- соответствие архитектуре «клиент-сервер»;
- наличие версий, работающих в разных ОС и на разных технических средствах;
- **интероперабельность** — способность работать совместно с системами другой архитектуры;
- **многопоточность**;
- средства обеспечения надёжности: ведение журнала транзакций, снятие резервной копии и восстановление **без остановки работы системы**;
- средства обеспечения целостности данных;
- средства оптимизации запросов;
- внутренние механизмы обеспечения безопасности;
- использование **балансировки нагрузки** при резервировании и формировании БД.

БД должна полностью соответствовать требованиям государственного стандарта **O'zDSt 1135:2007**.
