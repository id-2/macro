# Разрешённые следы прежнего имени

Проверка `scripts/check-old-brand.sh` читает эту таблицу и сама никаких исключений не хранит. Каждая строка отвечает на три вопроса: какое имя разрешено, где оно разрешено и почему его нельзя убрать сейчас.

- **Имя** — точное имя так, как его находит проверка. Слаг обрывается на втором дефисе, поэтому `macro-database-add` попадает под имя `macro-database`. Несколько имён в одной строке разделяются запятой.
- **Где** — шаблоны путей через запятую. Звёздочка закрывает и вложенные папки: `docs/*` покрывает `docs/design/x.md`. Одно звёздочное имя без папки закрывает весь репозиторий.
- **Почему** — причина, по которой имя осталось. Если причина перестала быть верной, строку удаляют, и проверка снова начинает ругаться на эти места.

Проверка ловит слаг (`macro-foo`), змеиный идентификатор (`macro_foo`), имя в стиле CamelCase (`MacroFoo`), переменную окружения (`MACRO_FOO`) и домен целиком (`macro.ai`, `macro.app`). В коде ищутся только идентификаторы, в документации, данных, стилях и сценариях — ещё слаги и домены.

| Имя | Где | Почему |
| --- | --- | --- |
| `macro-inc` | `*` | ссылки на исходный публичный репозиторий `macro-inc/macro` и одноимённую организацию на GitHub; это чужое имя, а не наше |
| `macro-demo` | `README.md`, `apps/docs/*` | адрес опубликованной страницы записи на демонстрацию и запись журнала изменений о том же маршруте |
| `macro-app` | `README.md`, `docs/*` | имя страницы приложения в App Store и имена проектов Firebase `macro-app-prod` и `macro-app-dev`; адреса магазина и проектов менять нельзя |
| `macro-cla` | `CONTRIBUTING.md`, `services/cla-worker/*` | команда `/macro-cla` в комментариях, которую читает обработчик соглашения, и её описание |
| `macro.ai` | `agent-teammates/starter-agent/*`, `apps/web/*`, `crates/*`, `docs/*`, `packages/sdk/*`, `packages/sdk-docs/*`, `packages/starter-agent/*`, `services/bots/*` | имя семейства инструментов агента в описаниях и подсказках; меняется только вместе с протоколом |
| `MacroUserIdStr` | `.sqlx/*` | тип Rust в сохранённом кэше запросов sqlx: кэш помнит имя до переименования и обновляется пересборкой запросов |
| `macro-inmem` | `.sqlx/*`, `docs/*` | прежнее значение поля harness у сессий агента и его описание в проектном документе; старые сессии читаются по этому значению |
| `macro-fusionauth` | `.agents/*` | имя контейнера FusionAuth на локальном стенде в навыке запуска |
| `macro_user` | `apps/docs/*`, `crates/*`, `infra/stacks/*`, `packages/sdk/*`, `services/agent_harness_service/*`, `tooling/ai_billing_cli/*`, `tooling/seed_cli/*` | имя крейта `macro_user_id` и его полей в документации и в данных стенда; переименование требует миграции |
| `MacroUserExtractor`, `macro-1614`, `macro_db`, `macro_device`, `macro_em`, `macro_env`, `macro_id`, `macro_middleware`, `macro_service` | `apps/docs/*` | записи журнала изменений о прошлых выпусках: имена крейтов и заявок тогда были такими |
| `macro-user` | `crates/universal_input/*`, `services/bots/*` | имена заголовков `x-internal-macro-user-id` и `x-rox-bot-for-macro-user-id`, которые уже отправляют клиенты |
| `macro-chat`, `macro-company`, `macro-composer`, `macro-control`, `macro-feature`, `macro-hero`, `macro-home`, `macro-homepage`, `macro-is`, `macro-letter`, `macro-motion`, `macro-preview`, `macro-product`, `macro-result`, `macro-selection`, `macro-standalone`, `macro-task`, `macro-text`, `macro-tile`, `macro-workflow`, `MacroDPA` | `apps/marketing/*` | имена CSS-классов разметки маркетинга; пользователь их не видит, разметка переименовывается отдельно |
| `macro-document`, `macro-email`, `macro-icon`, `macro-mark` | `apps/marketing/*`, `apps/web/*` | имена CSS-классов и значков в разметке маркетинга и приложения |
| `macro-message` | `apps/marketing/*`, `apps/web/*`, `docs/*` | имена CSS-классов пузыря сообщения и их упоминание в документации |
| `macro-database` | `apps/marketing/*`, `infra/stacks/*` | имена CSS-классов макета базы и панели наблюдения за базой |
| `macro-call` | `apps/marketing/*`, `services/call_recording_preview_handler/*` | имена CSS-классов макета звонка и ключ события в образце обработчика записи |
| `MACRO_SHEET`, `macro-assets`, `macro-await`, `macro-cef`, `macro-e2e`, `macro-enabled`, `macro-ios`, `macro-prox`, `macro-shell`, `macro-tauri`, `macro-toast`, `macro_quote` | `apps/web/*` | имена CSS-классов, префиксы кэша в service worker, переменные сборки и термины про макросы таблиц |
| `macro_rules` | `apps/web/*`, `crates/*`, `services/document_storage_service/*`, `services/email_service/*`, `services/sync-service/*`, `tooling/xtask/*`, `vendor/ironcalc/*` | служебное слово Rust для объявления макроса; не имя продукта |
| `macro_export` | `apps/web/*`, `crates/*`, `services/email_service/*`, `services/sync-service/*`, `tooling/xtask/*`, `vendor/ironcalc/*` | атрибут Rust, открывающий макрос наружу; не имя продукта |
| `macro-connect` | `apps/web/*`, `crates/connect_client/*`, `crates/pipedream_mcp/*`, `packages/sdk/*` | имя службы подключений в описании API и в документации |
| `macro-computers` | `apps/web/*`, `crates/feature_flags/*`, `crates/hosted_runtimes/*`, `docs/*`, `infra/stacks/*`, `nix/hosts/*`, `services/agent_harness_service/*`, `services/authentication_service/*` | имя подсистемы удалённых компьютеров и её флага `enable-macro-computers` |
| `macro-local` | `apps/web/*`, `crates/openbao_client/*`, `docs/*`, `infra/local/*`, `tooling/xtask/*` | имена локального стенда: кэш пакетов, профиль compose и путь OpenBao |
| `macro-free`, `macro.app` | `apps/web/*`, `docs/*` | «macro-free» — про таблицы Excel без макросов; `macro.app` осталось только в отдельном идентификаторе проверочной сборки `com.macro.app.e2e` |
| `macro-component`, `macro-style` | `apps/web/*`, `docs/*`, `services/ai-editing-worker/*` | имена директив разметки холста блоков в описании и подсказке |
| `macro-access`, `macro-api` | `apps/web/*`, `packages/sdk/*` | имена заголовков доступа в описаниях API; клиенты их уже отправляют |
| `macro-agent` | `crates/agent_harness/*`, `crates/coding_agent_worker/*`, `nix/macro-box/*`, `packages/starter-agent/*` | имя службы агента внутри MicroVM и её файлов запуска |
| `macro-code` | `crates/code_execution/*` | имя заголовка `x-macro-code-execution` в загрузчике Deno |
| `macro-box` | `crates/harnessd/*`, `crates/hosted_runtimes/*`, `docs/*`, `nix/hosts/*`, `nix/macro-box/*`, `packages/muppet/*`, `services/agent_harness_service/*` | имя подсистемы MicroVM, которая в дереве и на машинах до сих пор называется `macro-box` |
| `macro-lifecycle` | `crates/openbao_client/*`, `crates/passwords/*`, `docs/*`, `infra/local/*`, `infra/openbao/*` | имена политик жизненного цикла секретов OpenBao |
| `macro-audit` | `crates/openbao_client/*`, `infra/local/*`, `infra/openbao/*` | имена аудита в спецификации и в сценариях OpenBao |
| `macro-generated` | `crates/rox_service_urls/*` | английское «macro-generated» о типах, порождённых макросом, а не о продукте |
| `macro-brain` | `crates/team_agents/*` | имя службы гостевой машины агента |
| `macro-drafting` | `crates/scheduled_action/*` | имя docker-сети стенда замеров черновиков |
| `macro-access`, `macro-refresh`, `macro_user`, `macro-sdk`, `macro-rox`, `macro-email`, `macro_rules`, `macro-app` | `docs/rebrand-migration.md`, `docs/stand-runbook.md` | журнал переименования и книга стенда называют прежние имена, потому что описывают сам перенос |
| `macro-1509`, `macro-1989`, `macro-2014`, `macro-2061` | `crates/task_dedup/*` | номера старых заявок в образце данных для проверки склейки задач |
| `MACRO_API` | `docker/*`, `services/transcription/*`, `tooling/xtask/*` | имя переменной окружения службы расшифровки и её описание |
| `macro-3564`, `macro-android`, `macro-assetlinks`, `macro-computer`, `macro-lgtm`, `macro-sourcemap`, `macro-task03` | `docs/*` | имена веток, путей, контейнеров и номеров заявок прошлых выпусков в проектной документации |
| `macro-internal` | `docs/*`, `infra/openbao/*`, `infra/stacks/*` | имя внутреннего заголовка вызова и связанные с ним имена в инфраструктуре |
| `macro-db` | `docs/*`, `infra/stacks/*`, `services/whatsapp_session_service/*` | имена баз и путей доступа, используемые стендом и книгами дежурств |
| `macro-435922` | `docs/*`, `nix/hosts/*` | номер проекта Google Cloud, к которому привязаны ресурсы |
| `macro-eng` | `docs/*`, `services/unfurl_service/*` | имя рабочего пространства Linear в ссылках на заявки |
| `macro-certs` | `infra/local/*` | путь к каталогу самоподписанных сертификатов локального стенда |
| `macro-passwords` | `infra/local/*`, `infra/openbao/*` | имя службы и аудитории выпуска паролей в OpenBao |
| `macro-dev` | `infra/openbao/*`, `infra/stacks/*` | имена путей и профилей разработки в OpenBao и в стеке |
| `macro-alert`, `macro-alerts`, `macro_alerts`, `macro-cache`, `macro-channel`, `macro-ci`, `macro-observability`, `macro-postgres`, `macro-run`, `macro-web`, `macro-2731` | `infra/stacks/*` | имена стеков, контейнеров, дашбордов и правил тревог стендов наблюдения |
| `macro-boxes` | `nix/hosts/*` | имена правил сетевого экрана для машин MicroVM |
| `macro-chromium`, `macro-display`, `macro-openbox` | `nix/macro-box/*` | имена служб и файлов графической среды MicroVM |
| `macro-swagger2openapi` | `nix/swagger2openapi/*` | имя пакета в файле блокировки зависимостей |
| `macro-my` | `packages/sdk-mcp/*` | имя инструмента `macro-my_principal_id` в снимке описания инструментов |
| `macro-new`, `macro-token` | `services/agent_harness_service/*` | имя бота `@macro-new` и переменная нагрузки `macro-token` в описании службы агента |
| `macro-logging` | `services/dataloss_prevention_handler/*` | имя корзины журналов в образце события |
| `macro-permissions` | `services/unfurl_service/*` | заголовок старой заявки в примере разбора ссылок |
