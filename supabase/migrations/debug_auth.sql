CREATE OR REPLACE FUNCTION get_auth_users_debug()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  v_res JSON;
BEGIN
  SELECT json_agg(u) INTO v_res FROM auth.users u;
  RETURN v_res;
END;
$$;
