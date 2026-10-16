-- ============================================================
-- EduPoint LMS — Patch 014: Fix Point Levels RLS
-- ============================================================

-- แก้ไขสิทธิ์การเข้าถึง (RLS) ของตาราง point_settings
DROP POLICY IF EXISTS "Admin full access point_settings" ON point_settings;
CREATE POLICY "Admin full access point_settings" ON point_settings 
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'SUPER_ADMIN')
);

-- แก้ไขสิทธิ์การเข้าถึง (RLS) ของตาราง point_levels
DROP POLICY IF EXISTS "Admin full access point_levels" ON point_levels;
CREATE POLICY "Admin full access point_levels" ON point_levels 
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('SUPER_ADMIN', 'TEACHER'))
);
