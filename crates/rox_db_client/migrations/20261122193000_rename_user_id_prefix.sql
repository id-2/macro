-- Перенос префикса идентификатора пользователя из прежнего (macro|) в rox|.
--
-- Старые файлы миграций не редактируются: их контрольные суммы уже применены
-- базами. Поэтому всё, что изменилось в схеме (генерация идентификаторов,
-- проверки, функции), переносится вперёд этим файлом.
--
-- `"User".id` — первичный ключ, на который ссылаются десятки таблиц, часть из
-- них без ON UPDATE CASCADE. Поэтому внешние ключи, чьи колонки меняются,
-- временно снимаются, данные переписываются, а ключи восстанавливаются в
-- конце. Снятие идёт по замыканию: если ключ ссылается на переименованную
-- колонку, его колонки-источники тоже переименовываются, и ключи, ссылающиеся
-- уже на них, снимаются следующим шагом.
--
-- Переписываются только значения, целиком являющиеся одним идентификатором
-- пользователя (<префикс><email>); тексты писем, документов и сообщений не
-- затрагиваются. Неизменяемые журналы (`enterprise_audit` и
-- `slack_import_job`) сохраняют исходные значения: их триггеры запрещают
-- UPDATE.
--
-- Сгенерированные колонки, чьё выражение содержит прежний префикс, снимаются
-- до обновления данных и восстанавливаются с новым префиксом. На текущей
-- схеме `email_links.is_primary` уже не генерируемая колонка (20261112034207
-- перевела её в явный факт с триггером), поэтому этот шаг ничего не меняет.

BEGIN;

SET LOCAL lock_timeout = '30s';
SET LOCAL search_path = public, pg_temp;

-- Пересоздаём функцию, которая достраивает is_primary для старых писателей.
-- Пока она хранит прежний префикс, обновление rox_id через неё сбрасывало бы
-- признак основной почты у всех строк.
CREATE OR REPLACE FUNCTION public.email_links_preserve_legacy_primary() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.is_primary IS NULL THEN
        NEW.is_primary := NEW.provider = 'ROX'
            OR (NEW.rox_id = 'rox|' || lower(NEW.email_address::text)
                AND NOT EXISTS (
                    SELECT 1 FROM email_links AS rox
                    WHERE rox.rox_id = NEW.rox_id AND rox.provider = 'ROX'
                ));
    ELSIF TG_OP = 'UPDATE'
        AND NEW.is_primary IS NOT DISTINCT FROM OLD.is_primary
        AND (OLD.rox_id IS DISTINCT FROM NEW.rox_id
            OR OLD.email_address IS DISTINCT FROM NEW.email_address)
    THEN
        NEW.is_primary := NEW.rox_id = 'rox|' || lower(NEW.email_address::text)
            AND NOT EXISTS (
                SELECT 1 FROM email_links AS rox
                WHERE rox.rox_id = NEW.rox_id AND rox.provider = 'ROX'
            );
    END IF;
    IF NEW.is_primary THEN
        -- Retiring the previous primary is an ordinary is_primary update, so the
        -- demoted row keeps its own consent lifecycle.
        UPDATE email_links
        SET is_primary = false
        WHERE rox_id = NEW.rox_id AND id <> NEW.id AND is_primary;
    END IF;
    RETURN NEW;
END;
$$;

-- Снимаем страж согласия CRM на время переименования: смена rox_id у почты
-- логически не меняет подключение и не должна отзывать выданные согласия.
-- Вернём триггер после обновления данных.
DROP TRIGGER IF EXISTS email_links_revoke_crm_consent ON public.email_links;
DROP TRIGGER IF EXISTS email_links_preserve_legacy_primary ON public.email_links;

DO $$
DECLARE
    old_prefix CONSTANT text := 'mac' || 'ro|';
    new_prefix CONSTANT text := 'rox|';
    ident_pattern CONSTANT text := '^[^@[:space:]]+@[^@[:space:]]+$';

    fk record;
    chk record;
    chk_defs text[] := '{}';
    chk_def text;

    gen record;
    gen_defs text[] := '{}';
    gen_def text;

    def record;
    idx record;
    target record;
    changed boolean;
BEGIN
    -- Пары «таблица, колонка», которые переписываются даже тогда, когда
    -- значение не похоже на обычный <префикс><email>. Сюда входят таблицы из
    -- задачи, ссылки без внешних ключей и таблицы, на чьи предикаты завязаны
    -- проверки и частичные индексы.
    CREATE TEMP TABLE _rename_targets (
        tbl oid NOT NULL,
        attnum smallint NOT NULL,
        PRIMARY KEY (tbl, attnum)
    ) ON COMMIT DROP;

    INSERT INTO _rename_targets (tbl, attnum)
    SELECT to_regclass(v.tbl), a.attnum
    FROM (VALUES
        ('public."User"', 'id'),
        ('public.email_links', 'rox_id'),
        ('public.github_links', 'rox_id'),
        ('public.import_entity_written', 'rox_id'),
        ('public.promoted_shared_mailboxes', 'rox_id'),
        ('public.account_merge_request', 'rox_user_id'),
        ('public.account_merge_request', 'to_merge_rox_user_id'),
        ('public.enterprise_member_state', 'rox_user_id'),
        ('public.in_progress_email_link', 'rox_user_id'),
        ('public.in_progress_user_link', 'rox_user_id'),
        ('public.rox_user_email_verification', 'rox_user_id'),
        ('public.rox_user_info', 'rox_user_id'),
        ('public.rox_user_links', 'primary_rox_id'),
        ('public.rox_user_links', 'child_rox_id'),
        ('public.rox_user_voice', 'rox_user_id'),
        ('public.rox_identity_binding', 'rox_user_id'),
        ('public.entity', 'owner_id'),
        ('public.entity_access', 'source_id'),
        ('public.contacts_connections', 'user1'),
        ('public.contacts_connections', 'user2'),
        ('public."Document"', 'owner'),
        ('public."Project"', 'userId'),
        ('public."Chat"', 'userId'),
        ('public.agent_session', 'owner_id'),
        ('public.scheduled_action', 'owner'),
        ('public.activity_events', 'actor_id'),
        ('public.activity_events', 'subject_id'),
        ('public.email_scheduled_messages', 'actor_id'),
        ('public.comms_messages', 'sender_id'),
        ('public.comms_entity_mentions', 'entity_id'),
        ('public.comms_channel_agents', 'user_id'),
        ('public.comms_channel_participants', 'user_id')
    ) AS v(tbl, col)
    JOIN pg_attribute a
      ON a.attrelid = to_regclass(v.tbl)
     AND a.attname = v.col
     AND a.attnum > 0
     AND NOT a.attisdropped
    ON CONFLICT DO NOTHING;

    -- Внешние ключи снимаются по замыканию: ключ, который ссылается на уже
    -- переименованную колонку, сам становится переименованным, и его снимают
    -- вместе с ключами, ссылающимися на его колонки-источники.
    CREATE TEMP TABLE _rename_fks (
        fk_oid oid PRIMARY KEY,
        definition text NOT NULL
    ) ON COMMIT DROP;

    LOOP
        changed := false;
        FOR fk IN
            SELECT c.oid,
                   c.conrelid,
                   c.conrelid::regclass::text AS tbl,
                   c.conname,
                   c.conkey,
                   pg_get_constraintdef(c.oid) AS definition
            FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            WHERE c.contype = 'f'
              AND n.nspname = 'public'
              AND NOT EXISTS (
                  SELECT 1 FROM _rename_fks f WHERE f.fk_oid = c.oid
              )
              AND EXISTS (
                  SELECT 1
                  FROM unnest(c.confkey) AS k(attnum)
                  JOIN _rename_targets t
                    ON t.tbl = c.confrelid
                   AND t.attnum = k.attnum
              )
        LOOP
            INSERT INTO _rename_fks (fk_oid, definition) VALUES (
                fk.oid,
                format(
                    'ALTER TABLE %s ADD CONSTRAINT %I %s',
                    fk.tbl, fk.conname, fk.definition
                )
            );
            INSERT INTO _rename_targets (tbl, attnum)
            SELECT fk.conrelid, k.attnum
            FROM unnest(fk.conkey) AS k(attnum)
            ON CONFLICT DO NOTHING;
            changed := true;
        END LOOP;
        EXIT WHEN NOT changed;
    END LOOP;

    -- 1. Снимаем внешние ключи, чьи колонки будут переписаны.
    FOR fk IN
        SELECT c.conrelid::regclass::text AS tbl, c.conname
        FROM _rename_fks f
        JOIN pg_constraint c ON c.oid = f.fk_oid
    LOOP
        EXECUTE format(
            'ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I',
            fk.tbl, fk.conname
        );
    END LOOP;

    -- 2. Снимаем проверки, в тексте которых зашит прежний префикс. Сейчас это
    -- только entity_owner_id_matches_type: без снятия она не даст записать
    -- новые owner_id и не даст восстановить себя после переименования.
    FOR chk IN
        SELECT c.conrelid::regclass::text AS tbl,
               c.conname,
               pg_get_constraintdef(c.oid) AS definition
        FROM pg_constraint c
        WHERE c.contype = 'c'
          AND c.conrelid <> 0
          AND position(old_prefix in pg_get_constraintdef(c.oid)) > 0
    LOOP
        chk_defs := chk_defs || format(
            'ALTER TABLE %s ADD CONSTRAINT %I %s',
            chk.tbl,
            chk.conname,
            replace(chk.definition, old_prefix, new_prefix)
        );
        EXECUTE format(
            'ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I',
            chk.tbl, chk.conname
        );
    END LOOP;

    -- 3. Снимаем сгенерированные выражения со старым префиксом и запоминаем
    -- их заменённые версии. Колонки остаются на месте, значения сохраняются.
    FOR gen IN
        SELECT a.attrelid::regclass::text AS tbl,
               a.attname,
               pg_get_expr(d.adbin, d.adrelid) AS expression
        FROM pg_attribute a
        JOIN pg_attrdef d
          ON d.adrelid = a.attrelid
         AND d.adnum = a.attnum
        WHERE a.attgenerated <> ''
          AND position(old_prefix in pg_get_expr(d.adbin, d.adrelid)) > 0
    LOOP
        gen_defs := gen_defs || format(
            'ALTER TABLE %s ALTER COLUMN %I SET EXPRESSION AS (%s)',
            gen.tbl, gen.attname,
            replace(gen.expression, old_prefix, new_prefix)
        );
        EXECUTE format(
            'ALTER TABLE %s ALTER COLUMN %I DROP EXPRESSION',
            gen.tbl, gen.attname
        );
    END LOOP;

    -- 4. Сначала переименовываем саму учётную запись: триггеры на дочерних
    -- таблицах смогут сразу найти нового владельца.
    EXECUTE format(
        'UPDATE public."User" SET id = replace(id, %L, %L)
         WHERE id LIKE %L || ''%%''',
        old_prefix, new_prefix, old_prefix
    );

    -- 5. Переписываем перечисленные колонки. Колонки с UUID (rox_user_id,
    -- to_merge_rox_user_id, rox_id в import_entity_written) пропускаются:
    -- текстового префикса в них нет и быть не может. Порядок по имени таблицы
    -- детерминирован, чтобы зависимые триггеры видели уже обновлённого
    -- владельца (например, агенты прямых каналов раньше участников).
    FOR target IN
        SELECT t.tbl::regclass::text AS tbl, a.attname AS col
        FROM _rename_targets t
        JOIN pg_class c ON c.oid = t.tbl
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a
          ON a.attrelid = t.tbl
         AND a.attnum = t.attnum
        WHERE n.nspname = 'public'
          AND NOT a.attisdropped
          AND a.attgenerated = ''
          AND a.atttypid IN ('text'::regtype, 'varchar'::regtype, 'bpchar'::regtype)
        ORDER BY t.tbl::regclass::text, a.attnum
    LOOP
        EXECUTE format(
            'UPDATE %s SET %I = replace(%I, %L, %L)
             WHERE %I LIKE %L || ''%%''',
            target.tbl, target.col, target.col, old_prefix, new_prefix,
            target.col, old_prefix
        );
    END LOOP;

    -- 6. Остальные публичные текстовые колонки: только значения, целиком
    -- состоящие из одного <префикс><email>. Так переименование доходит до
    -- владельцев без внешних ключей, участников каналов и записей аудита
    -- действий, но не переписывает тексты сообщений и документов.
    -- enterprise_audit и slack_import_job пропущены: их триггеры запрещают
    -- UPDATE, а строки этих журналов остаются историческим свидетельством.
    FOR target IN
        SELECT c.relname AS tbl, a.attname AS col
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r', 'p')
          AND c.relname NOT IN ('enterprise_audit', 'slack_import_job')
          AND a.attnum > 0
          AND NOT a.attisdropped
          AND a.attgenerated = ''
          AND a.atttypid IN ('text'::regtype, 'varchar'::regtype, 'bpchar'::regtype)
        ORDER BY c.relname, a.attnum
    LOOP
        EXECUTE format(
            'UPDATE public.%I SET %I = replace(%I, %L, %L)
             WHERE %I LIKE %L || ''%%''
               AND substr(%I, %s) ~ %L',
            target.tbl, target.col, target.col, old_prefix, new_prefix,
            target.col, old_prefix,
            target.col, length(old_prefix) + 1, ident_pattern
        );
    END LOOP;

    -- 7. Значения по умолчанию, в которых зашит прежний префикс. Сейчас таких
    -- нет, но повторный запуск на промежуточной базе должен быть безопасным.
    FOR def IN
        SELECT a.attrelid::regclass::text AS tbl,
               a.attname,
               pg_get_expr(d.adbin, d.adrelid) AS expression
        FROM pg_attribute a
        JOIN pg_attrdef d
          ON d.adrelid = a.attrelid
         AND d.adnum = a.attnum
        WHERE a.attgenerated = ''
          AND position(old_prefix in pg_get_expr(d.adbin, d.adrelid)) > 0
    LOOP
        EXECUTE format(
            'ALTER TABLE %s ALTER COLUMN %I SET DEFAULT %s',
            def.tbl, def.attname,
            replace(def.expression, old_prefix, new_prefix)
        );
    END LOOP;

    -- 8. Возвращаем сгенерированные выражения с новым префиксом.
    FOR gen_def IN SELECT unnest(gen_defs)
    LOOP
        EXECUTE gen_def;
    END LOOP;

    -- 9. Возвращаем проверки с новым префиксом.
    FOR chk_def IN SELECT unnest(chk_defs)
    LOOP
        EXECUTE chk_def;
    END LOOP;

    -- 10. Пересобираем частичные индексы, чей предикат зашит на прежний
    -- префикс (контакты). После переименования строк старый предикат уже не
    -- выбирает ни одной строки, поэтому индекс нужно строить заново.
    FOR idx IN
        SELECT c.relname AS index_name,
               pg_get_indexdef(i.indexrelid) AS definition
        FROM pg_index i
        JOIN pg_class c ON c.oid = i.indexrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND position(old_prefix in pg_get_indexdef(i.indexrelid)) > 0
          AND NOT EXISTS (
              SELECT 1 FROM pg_constraint con
              WHERE con.conindid = i.indexrelid
          )
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS public.%I', idx.index_name);
        EXECUTE replace(idx.definition, old_prefix, new_prefix);
    END LOOP;

    -- 11. Возвращаем внешние ключи последними, когда все ссылающиеся колонки
    -- уже содержат новые значения.
    FOR fk IN
        SELECT definition FROM _rename_fks ORDER BY fk_oid
    LOOP
        EXECUTE fk.definition;
    END LOOP;
END;
$$;

-- Возвращаем триггеры. Их определения не зависят от префикса; функция
-- email_links_preserve_legacy_primary уже пересоздана с новым префиксом.
CREATE TRIGGER email_links_preserve_legacy_primary
BEFORE INSERT OR UPDATE OF rox_id, email_address, is_primary ON public.email_links
FOR EACH ROW EXECUTE FUNCTION public.email_links_preserve_legacy_primary();

CREATE TRIGGER email_links_revoke_crm_consent
AFTER UPDATE OF is_primary, deleting_at, disconnect_requested_at, needs_reauth,
    rox_id, email_address ON public.email_links
FOR EACH ROW WHEN (
    OLD.is_primary IS DISTINCT FROM NEW.is_primary
    OR OLD.deleting_at IS DISTINCT FROM NEW.deleting_at
    OR OLD.disconnect_requested_at IS DISTINCT FROM NEW.disconnect_requested_at
    OR (NOT OLD.needs_reauth AND NEW.needs_reauth)
    OR OLD.rox_id IS DISTINCT FROM NEW.rox_id
    OR OLD.email_address IS DISTINCT FROM NEW.email_address
)
EXECUTE FUNCTION public.crm_revoke_changed_mailbox_consent();

COMMIT;
