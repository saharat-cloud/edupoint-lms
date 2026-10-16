-- ============================================================
-- EduPoint LMS — Patch 007: Admin Create Student RPC
-- ============================================================
-- สร้าง Function เพื่อให้ Admin เพิ่มนักเรียนพร้อมกับสร้าง Auth Account ในทีเดียว

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION admin_create_student(
  p_student_code TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_nickname TEXT,
  p_card_number TEXT,
  p_education_level_id UUID,
  p_class_room_id UUID,
  p_status TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_email TEXT;
  v_password TEXT;
  v_student_id UUID;
BEGIN
  -- 1. ตรวจสอบสิทธิ์ (ต้องเป็น SUPER_ADMIN หรือ TEACHER)
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('SUPER_ADMIN', 'TEACHER')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: ไม่มีสิทธิ์สร้างนักเรียน';
  END IF;
  
  -- 2. สร้าง Email และ Password จากรหัสนักเรียน (รหัสผ่านเติม std ข้างหน้าเพื่อให้ยาวเกิน 6 ตัวอักษร)
  v_email := p_student_code || '@school.ac.th';
  v_password := 'std' || p_student_code;

  -- 3. ตรวจสอบข้อมูลซ้ำซ้อน
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RAISE EXCEPTION 'รหัสนักเรียนนี้มีในระบบ (Auth) อยู่แล้ว';
  END IF;
  IF EXISTS (SELECT 1 FROM students WHERE student_code = p_student_code) THEN
    RAISE EXCEPTION 'รหัสนักเรียนนี้มีในระบบ (Students) อยู่แล้ว';
  END IF;
  IF p_card_number IS NOT NULL AND p_card_number != '' THEN
    IF EXISTS (SELECT 1 FROM students WHERE card_number = p_card_number) THEN
      RAISE EXCEPTION 'หมายเลขบัตรนี้ซ้ำกับนักเรียนคนอื่น';
    END IF;
  END IF;

  v_user_id := gen_random_uuid();
  
  -- 4. สร้าง User ในระบบ Auth ของ Supabase
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, 
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, 
    created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', 
    v_user_id, 
    'authenticated', 
    'authenticated', 
    v_email,
    extensions.crypt(v_password, extensions.gen_salt('bf')),
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
  
  -- 5. สร้าง Identity
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, provider_id
  ) VALUES (
    gen_random_uuid(), 
    v_user_id, 
    format('{"sub":"%s","email":"%s"}', v_user_id::text, v_email)::jsonb, 
    'email', 
    now(), 
    now(), 
    now(), 
    v_user_id::text
  );

  -- 6. อัปเดต Profile ทันที
  UPDATE profiles 
  SET role = 'STUDENT', 
      full_name = p_first_name || ' ' || p_last_name,
      updated_at = now()
  WHERE id = v_user_id;

  -- 7. สร้างเรคคอร์ดในตาราง students และเชื่อมโยง user_id
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
