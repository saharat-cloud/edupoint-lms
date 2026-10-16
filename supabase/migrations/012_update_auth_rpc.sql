-- ============================================================
-- EduPoint LMS — Patch 012: Update Auth RPC for Email/Password
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Update admin_create_student to accept email and password
CREATE OR REPLACE FUNCTION admin_create_student(
  p_student_code TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_nickname TEXT,
  p_card_number TEXT,
  p_education_level_id UUID,
  p_class_room_id UUID,
  p_status TEXT,
  p_email TEXT,
  p_password TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_student_id UUID;
BEGIN
  -- 1. ตรวจสอบสิทธิ์ (ต้องเป็น SUPER_ADMIN หรือ TEACHER)
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('SUPER_ADMIN', 'TEACHER')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: ไม่มีสิทธิ์สร้างนักเรียน';
  END IF;
  
  -- 2. ตรวจสอบข้อมูลซ้ำซ้อน
  IF p_email IS NOT NULL AND p_email != '' THEN
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
      RAISE EXCEPTION 'อีเมลนี้มีในระบบ (Auth) อยู่แล้ว';
    END IF;
  END IF;
  IF p_student_code IS NOT NULL AND p_student_code != '' THEN
    IF EXISTS (SELECT 1 FROM students WHERE student_code = p_student_code) THEN
      RAISE EXCEPTION 'รหัสนักเรียนนี้มีในระบบ (Students) อยู่แล้ว';
    END IF;
  END IF;
  IF p_card_number IS NOT NULL AND p_card_number != '' THEN
    IF EXISTS (SELECT 1 FROM students WHERE card_number = p_card_number) THEN
      RAISE EXCEPTION 'หมายเลขบัตรนี้ซ้ำกับนักเรียนคนอื่น';
    END IF;
  END IF;

  v_user_id := gen_random_uuid();
  
  -- 3. สร้าง User ในระบบ Auth ของ Supabase
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, 
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, 
    created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', 
    v_user_id, 
    'authenticated', 
    'authenticated', 
    COALESCE(NULLIF(p_email, ''), p_student_code || '@school.local'),
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', p_first_name || ' ' || p_last_name, 'role', 'STUDENT'),
    now(), 
    now(),
    '',
    '',
    '',
    ''
  );
  
  -- 4. สร้าง Identity
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, provider_id
  ) VALUES (
    gen_random_uuid(), 
    v_user_id, 
    format('{"sub":"%s","email":"%s"}', v_user_id::text, COALESCE(NULLIF(p_email, ''), p_student_code || '@school.local'))::jsonb, 
    'email', 
    now(), 
    now(), 
    now(), 
    v_user_id::text
  );

  -- 5. อัปเดต Profile ทันที
  UPDATE profiles 
  SET role = 'STUDENT', 
      full_name = p_first_name || ' ' || p_last_name,
      updated_at = now()
  WHERE id = v_user_id;

  -- 6. สร้างเรคคอร์ดในตาราง students และเชื่อมโยง user_id
  INSERT INTO students (
    user_id, student_code, first_name, last_name, nickname, 
    card_number, education_level_id, class_room_id, status
  ) VALUES (
    v_user_id, p_student_code, p_first_name, p_last_name, p_nickname,
    NULLIF(p_card_number, ''), p_education_level_id, p_class_room_id, p_status::student_status
  ) RETURNING id INTO v_student_id;

  -- แจ้ง PostgREST
  NOTIFY pgrst, 'reload schema';

  RETURN v_student_id;
END;
$$;


-- 2. Create admin_update_user_auth
CREATE OR REPLACE FUNCTION admin_update_user_auth(
  p_user_id UUID,
  p_email TEXT,
  p_password TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. ตรวจสอบสิทธิ์ (ต้องเป็น SUPER_ADMIN หรือ TEACHER)
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('SUPER_ADMIN', 'TEACHER')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: ไม่มีสิทธิ์อัปเดตข้อมูลผู้ใช้';
  END IF;

  -- 2. อัปเดตอีเมลถ้าระบุ
  IF p_email IS NOT NULL AND p_email != '' THEN
    -- Check if email exists for another user
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email AND id != p_user_id) THEN
      RAISE EXCEPTION 'อีเมลนี้มีผู้ใช้งานอื่นใช้อยู่แล้ว';
    END IF;

    UPDATE auth.users SET email = p_email, updated_at = now() WHERE id = p_user_id;
    
    -- อัปเดต identity
    UPDATE auth.identities 
    SET identity_data = format('{"sub":"%s","email":"%s"}', p_user_id::text, p_email)::jsonb,
        updated_at = now()
    WHERE user_id = p_user_id AND provider = 'email';
  END IF;

  -- 3. อัปเดตรหัสผ่านถ้าระบุ
  IF p_password IS NOT NULL AND p_password != '' THEN
    UPDATE auth.users 
    SET encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), 
        updated_at = now() 
    WHERE id = p_user_id;
  END IF;

END;
$$;
-- 3. Get User Email
CREATE OR REPLACE FUNCTION admin_get_user_email(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_email TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('SUPER_ADMIN', 'TEACHER')) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  RETURN v_email;
END;
$func$;
-- 4. Update admin_create_teacher to support role
DROP FUNCTION IF EXISTS admin_create_teacher(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION admin_create_teacher(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_role TEXT DEFAULT 'TEACHER'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_id UUID;
BEGIN
  -- 1. ????????????? (???????? SUPER_ADMIN ????????)
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: ????????????????????????';
  END IF;
  
  -- 2. ?????????? Email ??????????
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RAISE EXCEPTION 'Email ???????????????????';
  END IF;

  v_user_id := gen_random_uuid();
  
  -- 3. ????? User ?????? Auth ??? Supabase ??????
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
    jsonb_build_object('full_name', p_full_name, 'role', p_role),
    now(), 
    now(),
    '',
    '',
    '',
    ''
  );
  
  -- 4. ????? Identity (??????????????????)
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', p_email),
    'email',
    now(),
    now(),
    now()
  );
  
  RETURN v_user_id;
END;
$func$;
