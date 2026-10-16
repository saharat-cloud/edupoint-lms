-- 008_admin_delete_user_rpc.sql

-- ฟังก์ชันสำหรับลบผู้ใช้ (นักเรียน/ครู) ออกจากระบบอย่างสมบูรณ์
-- รวมทั้งลบจาก auth.users, profiles, auth.identities
CREATE OR REPLACE FUNCTION admin_delete_user(p_user_id UUID)
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
    RAISE EXCEPTION 'Unauthorized: ไม่มีสิทธิ์ลบผู้ใช้งาน';
  END IF;

  -- 2. ลบออกจาก auth.users (จะลบจาก auth.identities อัตโนมัติถ้ามี FK, แต่เพื่อความชัวร์ลบเองได้)
  DELETE FROM auth.identities WHERE user_id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;
  
  -- หมายเหตุ: profiles มี ON DELETE CASCADE จาก auth.users
  -- ส่วน students มี ON DELETE SET NULL ดังนั้นเราไม่ต้องลบซ้ำ แต่ในโค้ด frontend ควบคุมการลบ students.id 
END;
$$;
