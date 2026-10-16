-- ============================================================
-- EduPoint LMS — Patch 006: Admin Create Teacher RPC
-- ============================================================
-- สร้าง Function เพื่อให้ Admin สามารถเพิ่มครูใหม่ได้จากหน้าเว็บโดยตรง
-- (หลีกเลี่ยงการใช้ Service Role Key ใน Frontend)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION admin_create_teacher(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- 1. ตรวจสอบสิทธิ์ (ต้องเป็น SUPER_ADMIN เท่านั้น)
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: เฉพาะผู้ดูแลระบบเท่านั้น';
  END IF;
  
  -- 2. ตรวจสอบว่า Email ซ้ำหรือไม่
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RAISE EXCEPTION 'Email นี้มีอยู่ในระบบแล้ว';
  END IF;

  v_user_id := gen_random_uuid();
  
  -- 3. สร้าง User ในระบบ Auth ของ Supabase โดยตรง
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, 
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, 
    created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', 
    v_user_id, 
    'authenticated', 
    'authenticated', 
    p_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', p_full_name, 'role', 'TEACHER'),
    now(), 
    now(),
    '',
    '',
    '',
    ''
  );
  
  -- 4. สร้าง Identity (เพื่อให้ล็อกอินได้)
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, provider_id
  ) VALUES (
    gen_random_uuid(), 
    v_user_id, 
    format('{"sub":"%s","email":"%s"}', v_user_id::text, p_email)::jsonb, 
    'email', 
    now(), 
    now(), 
    now(), 
    v_user_id::text
  );

  -- 5. บังคับอัปเดต Profile ให้เป็น TEACHER ทันที (เผื่อ Trigger ทำงานช้าหรือตกหล่น)
  UPDATE profiles 
  SET role = 'TEACHER', 
      full_name = p_full_name,
      updated_at = now()
  WHERE id = v_user_id;

  -- แจ้งให้ PostgREST รับทราบ
  NOTIFY pgrst, 'reload schema';

  RETURN v_user_id;
END;
$$;
