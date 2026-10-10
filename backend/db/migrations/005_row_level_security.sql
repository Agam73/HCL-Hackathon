-- =====================================================================
-- Lock the tables to the API's own database role.
--
-- On a hosted Postgres such as Supabase, every table in "public" is also
-- reachable through an auto-generated REST API using the project's public
-- key. With row level security on and no policies, those API roles can
-- read and write nothing. The backend connects as the table owner, which
-- is not subject to row level security, so it is unaffected.
--
-- New tables need the same line - add it in the migration that creates them.
-- =====================================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
