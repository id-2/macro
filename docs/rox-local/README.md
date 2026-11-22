# Локальный стенд Rox

Заметки о запуске и обслуживании локального набора `rox-one`.

## Миграции базы

- Новый `document_storage_service` (сборка из HEAD, поле `alsoListedAs` в инбоксе уведомлений) читает `team_user.crm_access`. Если этой колонки нет, инбокс отдаёт «the notification inbox is unavailable» с ошибкой `column tu.crm_access does not exist`. Колонку добавляет миграция `crates/rox_db_client/migrations/20261114170231_crm_member_access.sql`; на стендах, где её в истории `_sqlx_migrations` не было, применяйте так:
  `ALTER TABLE team_user ADD COLUMN IF NOT EXISTS crm_access boolean NOT NULL DEFAULT true;`
  и записывайте строку в `_sqlx_migrations` с sha384-контролем файла миграции, иначе следующая миграция попробует добавить колонку повторно.
