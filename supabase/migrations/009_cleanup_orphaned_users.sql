-- 009_cleanup_orphaned_users.sql

-- 1. ฟังก์ชันลบผู้ใช้ออกจากระบบ (Auth) เมื่อกดลบในหน้าจัดการ
CREATE OR REPLACE FUNCTION admin_delete_user(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('SUPER_ADMIN', 'TEACHER')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM auth.identities WHERE user_id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

-- 2. สคริปต์ทำความสะอาด (Cleanup) สำหรับนักเรียนที่ถูกลบไปก่อนหน้านี้
-- ลบ User ในระบบ Auth ที่เป็น STUDENT แต่ไม่มีข้อมูลในตาราง students แล้ว
DELETE FROM auth.identities 
WHERE user_id IN (
  SELECT u.id 
  FROM auth.users u
  LEFT JOIN students s ON u.id = s.user_id
  WHERE u.raw_user_meta_data->>'role' = 'STUDENT' AND s.id IS NULL
);

DELETE FROM auth.users 
WHERE id IN (
  SELECT u.id 
  FROM auth.users u
  LEFT JOIN students s ON u.id = s.user_id
  WHERE u.raw_user_meta_data->>'role' = 'STUDENT' AND s.id IS NULL
);
