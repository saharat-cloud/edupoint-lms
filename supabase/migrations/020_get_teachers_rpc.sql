-- Drop the previous version to ensure clean replacement
DROP FUNCTION IF EXISTS get_teachers_and_admins();

-- Create a SECURITY DEFINER function to bypass RLS and fetch all teachers and admins
CREATE OR REPLACE FUNCTION get_teachers_and_admins()
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  role TEXT,
  email TEXT
) LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT 
    p.id, 
    p.full_name, 
    p.role::text, 
    u.email::text
  FROM profiles p
  JOIN auth.users u ON p.id = u.id
  WHERE p.role IN ('TEACHER', 'SUPER_ADMIN')
  ORDER BY p.full_name;
$$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
