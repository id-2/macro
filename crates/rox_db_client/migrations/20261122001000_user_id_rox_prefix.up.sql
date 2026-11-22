-- Rewrite every stored user id from the legacy `macro|<email>` prefix to the
-- current `rox|<email>` one. Accounts, sessions and record ownership are kept:
-- only the six-character prefix changes, the email part is untouched.
--
-- The affected columns are found at run time from information_schema, so a
-- text column that holds user ids does not have to be listed here by hand.
-- Foreign keys that point at a rewritten column are temporarily dropped and
-- recreated with their original definition, because most of them are NOT
-- DEFERRABLE and would reject a parent/child update in either order.
--
-- A count is taken before and after the rewrite. The migration fails rather
-- than leaving a partial rename if any `macro|` value survives.
DO $$
DECLARE
    target record;
    saved_fk record;
    saved_trigger record;
    saved_index record;
    saved_function record;
    affected bigint;
    updated bigint;
    total_before bigint := 0;
    total_after bigint := 0;
    column_count bigint := 0;
    remaining bigint;
BEGIN
    CREATE TEMP TABLE _rox_user_id_targets (
        table_schema text NOT NULL,
        table_name text NOT NULL,
        column_name text NOT NULL,
        row_count bigint NOT NULL
    ) ON COMMIT DROP;

    CREATE TEMP TABLE _rox_user_id_saved_fks (
        constraint_name text NOT NULL,
        child_table text NOT NULL,
        definition text NOT NULL
    ) ON COMMIT DROP;

    CREATE TEMP TABLE _rox_user_id_saved_checks (
        constraint_name text NOT NULL,
        child_table text NOT NULL,
        definition text NOT NULL
    ) ON COMMIT DROP;

    CREATE TEMP TABLE _rox_user_id_saved_triggers (
        table_schema text NOT NULL,
        table_name text NOT NULL,
        trigger_name text NOT NULL
    ) ON COMMIT DROP;

    CREATE TEMP TABLE _rox_user_id_saved_indexes (
        index_schema text NOT NULL,
        index_name text NOT NULL,
        definition text NOT NULL
    ) ON COMMIT DROP;

    -- Enumerate every updatable text column and keep the ones that actually
    -- start with the legacy prefix.
    FOR target IN
        SELECT c.table_schema, c.table_name, c.column_name
        FROM information_schema.columns c
        JOIN information_schema.tables t
          ON t.table_schema = c.table_schema
         AND t.table_name = c.table_name
         AND t.table_type = 'BASE TABLE'
        WHERE c.data_type IN ('text', 'character varying')
          AND c.is_generated = 'NEVER'
          AND c.is_updatable = 'YES'
          AND c.table_schema NOT IN ('pg_catalog', 'information_schema')
          AND (c.table_schema, c.table_name) <> ('public', '_sqlx_migrations')
        ORDER BY c.table_schema, c.table_name, c.column_name
    LOOP
        EXECUTE format(
            'SELECT count(*) FROM %I.%I WHERE %I LIKE %L',
            target.table_schema, target.table_name, target.column_name, 'macro|%'
        ) INTO affected;

        IF affected > 0 THEN
            INSERT INTO _rox_user_id_targets
            VALUES (target.table_schema, target.table_name, target.column_name, affected);
            total_before := total_before + affected;
            column_count := column_count + 1;
        END IF;
    END LOOP;

    RAISE NOTICE 'user id rewrite: % row(s) in % column(s) carry the macro prefix',
        total_before, column_count;

    -- Save every foreign key that points at one of the columns about to be
    -- rewritten, then drop it so the value update is unconstrained.
    INSERT INTO _rox_user_id_saved_fks (constraint_name, child_table, definition)
    SELECT con.conname,
           format('%I.%I', child_ns.nspname, child.relname),
           pg_get_constraintdef(con.oid)
    FROM pg_constraint con
    JOIN pg_class child ON child.oid = con.conrelid
    JOIN pg_namespace child_ns ON child_ns.oid = child.relnamespace
    JOIN pg_class parent ON parent.oid = con.confrelid
    JOIN pg_namespace parent_ns ON parent_ns.oid = parent.relnamespace
    WHERE con.contype = 'f'
      AND EXISTS (
          SELECT 1
          FROM unnest(con.confkey) AS key(attnum)
          JOIN pg_attribute attribute
            ON attribute.attrelid = con.confrelid
           AND attribute.attnum = key.attnum
          JOIN _rox_user_id_targets candidate
            ON candidate.table_schema = parent_ns.nspname
           AND candidate.table_name = parent.relname
           AND candidate.column_name = attribute.attname
      );

    FOR saved_fk IN SELECT * FROM _rox_user_id_saved_fks LOOP
        EXECUTE format(
            'ALTER TABLE %s DROP CONSTRAINT %I',
            saved_fk.child_table, saved_fk.constraint_name
        );
    END LOOP;

    -- Check constraints can compare two rewritten columns (for example an
    -- ordering rule on a pair of user ids), so they are dropped and recreated
    -- around the update too.
    INSERT INTO _rox_user_id_saved_checks (constraint_name, child_table, definition)
    SELECT con.conname,
           format('%I.%I', child_ns.nspname, child.relname),
           pg_get_constraintdef(con.oid)
    FROM pg_constraint con
    JOIN pg_class child ON child.oid = con.conrelid
    JOIN pg_namespace child_ns ON child_ns.oid = child.relnamespace
    WHERE con.contype = 'c'
      AND EXISTS (
          SELECT 1
          FROM unnest(con.conkey) AS key(attnum)
          JOIN pg_attribute attribute
            ON attribute.attrelid = con.conrelid
           AND attribute.attnum = key.attnum
          JOIN _rox_user_id_targets candidate
            ON candidate.table_schema = child_ns.nspname
           AND candidate.table_name = child.relname
           AND candidate.column_name = attribute.attname
      );

    FOR saved_fk IN SELECT * FROM _rox_user_id_saved_checks LOOP
        EXECUTE format(
            'ALTER TABLE %s DROP CONSTRAINT %I',
            saved_fk.child_table, saved_fk.constraint_name
        );
    END LOOP;

    -- A few tables are append-only and reject every UPDATE from a trigger.
    -- A prefix-only rewrite must still reach those rows, so enabled user
    -- triggers are switched off for the duration and restored afterwards.
    INSERT INTO _rox_user_id_saved_triggers (table_schema, table_name, trigger_name)
    SELECT DISTINCT parent_ns.nspname, parent.relname, trigger.tgname
    FROM pg_trigger trigger
    JOIN pg_class parent ON parent.oid = trigger.tgrelid
    JOIN pg_namespace parent_ns ON parent_ns.oid = parent.relnamespace
    JOIN _rox_user_id_targets candidate
      ON candidate.table_schema = parent_ns.nspname
     AND candidate.table_name = parent.relname
    WHERE NOT trigger.tgisinternal
      AND trigger.tgenabled IN ('O', 'A', 'R');

    FOR saved_trigger IN SELECT * FROM _rox_user_id_saved_triggers LOOP
        EXECUTE format(
            'ALTER TABLE %I.%I DISABLE TRIGGER %I',
            saved_trigger.table_schema, saved_trigger.table_name, saved_trigger.trigger_name
        );
    END LOOP;

    -- Partial indexes whose predicate names the old prefix stop covering the
    -- rewritten rows. Recreate them with the current prefix.
    INSERT INTO _rox_user_id_saved_indexes (index_schema, index_name, definition)
    SELECT index_ns.nspname, index_class.relname, pg_get_indexdef(index_class.oid)
    FROM pg_index index_meta
    JOIN pg_class index_class ON index_class.oid = index_meta.indexrelid
    JOIN pg_namespace index_ns ON index_ns.oid = index_class.relnamespace
    WHERE pg_get_indexdef(index_class.oid) LIKE '%macro|%';

    FOR saved_index IN SELECT * FROM _rox_user_id_saved_indexes LOOP
        EXECUTE format(
            'DROP INDEX %I.%I',
            saved_index.index_schema, saved_index.index_name
        );
    END LOOP;

    FOR target IN SELECT * FROM _rox_user_id_targets ORDER BY table_schema, table_name, column_name LOOP
        EXECUTE format(
            'UPDATE %I.%I SET %I = %L || substr(%I, 7) WHERE %I LIKE %L',
            target.table_schema, target.table_name, target.column_name,
            'rox|', target.column_name, target.column_name, 'macro|%'
        );
        GET DIAGNOSTICS updated = ROW_COUNT;
        IF updated <> target.row_count THEN
            RAISE EXCEPTION
                'user id rewrite: %.%.% changed % row(s), expected %',
                target.table_schema, target.table_name, target.column_name,
                updated, target.row_count;
        END IF;
        RAISE NOTICE 'user id rewrite: %.%.% -> % row(s)',
            target.table_schema, target.table_name, target.column_name, updated;
    END LOOP;

    FOR saved_fk IN SELECT * FROM _rox_user_id_saved_fks LOOP
        EXECUTE format(
            'ALTER TABLE %s ADD CONSTRAINT %I %s',
            saved_fk.child_table, saved_fk.constraint_name, saved_fk.definition
        );
    END LOOP;

    FOR saved_fk IN SELECT * FROM _rox_user_id_saved_checks LOOP
        EXECUTE format(
            'ALTER TABLE %s ADD CONSTRAINT %I %s',
            saved_fk.child_table, saved_fk.constraint_name,
            replace(
                saved_fk.definition,
                'owner_id ~~ ''macro|%''::text',
                '(owner_id ~~ ''macro|%'' OR owner_id ~~ ''rox|%'')'
            )
        );
    END LOOP;
    FOR saved_index IN SELECT * FROM _rox_user_id_saved_indexes LOOP
        EXECUTE replace(saved_index.definition, 'macro|%', 'rox|%');
    END LOOP;

    -- Function bodies are stored as text. The mailbox-primary trigger compares
    -- a stored id against the prefix plus the email, so its literal moves too.
    FOR saved_function IN
        SELECT procedure.oid, pg_get_functiondef(procedure.oid) AS definition
        FROM pg_proc procedure
        JOIN pg_namespace function_ns ON function_ns.oid = procedure.pronamespace
        WHERE function_ns.nspname NOT IN ('pg_catalog', 'information_schema')
          AND procedure.prosrc LIKE '%macro|%'
    LOOP
        EXECUTE replace(
            saved_function.definition,
            'macro|',
            'rox|'
        );
    END LOOP;

    FOR saved_trigger IN SELECT * FROM _rox_user_id_saved_triggers LOOP
        EXECUTE format(
            'ALTER TABLE %I.%I ENABLE TRIGGER %I',
            saved_trigger.table_schema, saved_trigger.table_name, saved_trigger.trigger_name
        );
    END LOOP;

    -- The check that makes the migration safe to retry and to reason about:
    -- nothing may still carry the old prefix.
    FOR target IN SELECT * FROM _rox_user_id_targets LOOP
        EXECUTE format(
            'SELECT count(*) FROM %I.%I WHERE %I LIKE %L',
            target.table_schema, target.table_name, target.column_name, 'macro|%'
        ) INTO remaining;
        total_after := total_after + remaining;
    END LOOP;

    IF total_after <> 0 THEN
        RAISE EXCEPTION
            'user id rewrite: % macro-prefixed value(s) survived across % column(s)',
            total_after, column_count;
    END IF;

    RAISE NOTICE 'user id rewrite: complete; % row(s) in % column(s), 0 remaining',
        total_before, column_count;
END
$$;
