-- ============================================================
-- EduPoint LMS — Patch 013: Point Settings & Levels
-- ============================================================

CREATE TABLE IF NOT EXISTS point_settings (
  id INT PRIMARY KEY DEFAULT 1,
  term_max_points INT NOT NULL DEFAULT 100000,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE point_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read point_settings" ON point_settings;
CREATE POLICY "Public read point_settings" ON point_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin full access point_settings" ON point_settings;
CREATE POLICY "Admin full access point_settings" ON point_settings USING (auth.jwt() ->> 'role' = 'SUPER_ADMIN');

INSERT INTO point_settings (id, term_max_points) VALUES (1, 100000) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS point_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  min_points INT NOT NULL,
  max_points INT,
  color VARCHAR(50) DEFAULT 'slate',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE point_levels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read point_levels" ON point_levels;
CREATE POLICY "Public read point_levels" ON point_levels FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin full access point_levels" ON point_levels;
CREATE POLICY "Admin full access point_levels" ON point_levels USING (auth.jwt() ->> 'role' = 'SUPER_ADMIN' OR auth.jwt() ->> 'role' = 'TEACHER');

-- Seed default levels if empty
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM point_levels) THEN
    INSERT INTO point_levels (name, min_points, max_points, color, sort_order) VALUES
    ('ผู้เริ่มต้น (Novice)', 0, 999, 'slate', 1),
    ('นักรบ (Fighter)', 1000, 4999, 'green', 2),
    ('ผู้เชี่ยวชาญ (Expert)', 5000, 9999, 'blue', 3),
    ('ปรมาจารย์ (Master)', 10000, 49999, 'purple', 4),
    ('ตำนาน (Legend)', 50000, NULL, 'amber', 5);
  END IF;
END $$;
