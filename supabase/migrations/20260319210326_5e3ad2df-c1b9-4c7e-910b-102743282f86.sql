
-- Create a security definer function to execute cron scheduling SQL
-- This is needed because pg_cron functions run in pg_catalog schema
CREATE OR REPLACE FUNCTION public.exec_sql(sql_query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, cron, extensions
AS $$
DECLARE
  result jsonb;
BEGIN
  EXECUTE sql_query INTO result;
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- Revoke public access, only service role should call this
REVOKE ALL ON FUNCTION public.exec_sql(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.exec_sql(text) FROM anon;
REVOKE ALL ON FUNCTION public.exec_sql(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;

-- Helper to get cron job details
CREATE OR REPLACE FUNCTION public.get_cron_job_details(p_job_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, cron
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT row_to_json(j)::jsonb INTO result
  FROM cron.job j
  WHERE j.jobid = p_job_id;
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.get_cron_job_details(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_cron_job_details(bigint) FROM anon;
REVOKE ALL ON FUNCTION public.get_cron_job_details(bigint) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_cron_job_details(bigint) TO service_role;
