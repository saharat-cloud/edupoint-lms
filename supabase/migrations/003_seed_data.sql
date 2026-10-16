-- ============================================================
-- EduPoint LMS — Seed Data (ข้อมูลเริ่มต้น)
-- Run AFTER 001 + 002 migrations
-- ============================================================

-- ============================================================
-- 1. EDUCATION LEVELS (ระดับการศึกษา)
-- ============================================================
INSERT INTO education_levels (name, code, sort_order) VALUES
  ('ประถมศึกษาปีที่ 1', 'P1',  1),
  ('ประถมศึกษาปีที่ 2', 'P2',  2),
  ('ประถมศึกษาปีที่ 3', 'P3',  3),
  ('ประถมศึกษาปีที่ 4', 'P4',  4),
  ('ประถมศึกษาปีที่ 5', 'P5',  5),
  ('ประถมศึกษาปีที่ 6', 'P6',  6),
  ('มัธยมศึกษาปีที่ 1', 'M1',  7),
  ('มัธยมศึกษาปีที่ 2', 'M2',  8),
  ('มัธยมศึกษาปีที่ 3', 'M3',  9),
  ('มัธยมศึกษาปีที่ 4', 'M4', 10),
  ('มัธยมศึกษาปีที่ 5', 'M5', 11),
  ('มัธยมศึกษาปีที่ 6', 'M6', 12),
  ('ปวช.1', 'V1', 13),
  ('ปวช.2', 'V2', 14),
  ('ปวช.3', 'V3', 15)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 2. ACADEMIC YEAR (ปีการศึกษา)
-- ============================================================
INSERT INTO academic_years (name, start_date, end_date, status) VALUES
  ('2567', '2024-05-16', '2025-03-31', 'CLOSED'),
  ('2568', '2025-05-16', '2026-03-31', 'ACTIVE')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 3. SEMESTERS (ภาคเรียน)
-- ============================================================
INSERT INTO semesters (academic_year_id, name, start_date, end_date, status)
SELECT
  ay.id,
  ay.name || ' ภาคเรียนที่ 1',
  CASE WHEN ay.name = '2568' THEN '2025-05-16'::DATE ELSE '2024-05-16'::DATE END,
  CASE WHEN ay.name = '2568' THEN '2025-10-10'::DATE ELSE '2024-10-10'::DATE END,
  CASE WHEN ay.name = '2568' THEN 'CLOSED'::semester_status ELSE 'CLOSED'::semester_status END
FROM academic_years ay
WHERE ay.name IN ('2567', '2568')
ON CONFLICT DO NOTHING;

INSERT INTO semesters (academic_year_id, name, start_date, end_date, status)
SELECT
  ay.id,
  ay.name || ' ภาคเรียนที่ 2',
  CASE WHEN ay.name = '2568' THEN '2025-11-01'::DATE ELSE '2024-11-01'::DATE END,
  CASE WHEN ay.name = '2568' THEN '2026-03-31'::DATE ELSE '2025-03-31'::DATE END,
  CASE WHEN ay.name = '2568' THEN 'ACTIVE'::semester_status ELSE 'CLOSED'::semester_status END
FROM academic_years ay
WHERE ay.name IN ('2567', '2568')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. CLASS ROOMS (ห้องเรียน)
-- ============================================================
INSERT INTO class_rooms (education_level_id, academic_year_id, name, room_code, max_students)
SELECT el.id, ay.id, 'ม.4/1', 'M4-1', 35
FROM education_levels el, academic_years ay
WHERE el.code = 'M4' AND ay.status = 'ACTIVE' LIMIT 1
ON CONFLICT (room_code) DO NOTHING;

INSERT INTO class_rooms (education_level_id, academic_year_id, name, room_code, max_students)
SELECT el.id, ay.id, 'ม.4/2', 'M4-2', 35
FROM education_levels el, academic_years ay
WHERE el.code = 'M4' AND ay.status = 'ACTIVE' LIMIT 1
ON CONFLICT (room_code) DO NOTHING;

INSERT INTO class_rooms (education_level_id, academic_year_id, name, room_code, max_students)
SELECT el.id, ay.id, 'ม.5/1', 'M5-1', 35
FROM education_levels el, academic_years ay
WHERE el.code = 'M5' AND ay.status = 'ACTIVE' LIMIT 1
ON CONFLICT (room_code) DO NOTHING;

INSERT INTO class_rooms (education_level_id, academic_year_id, name, room_code, max_students)
SELECT el.id, ay.id, 'ม.5/2', 'M5-2', 35
FROM education_levels el, academic_years ay
WHERE el.code = 'M5' AND ay.status = 'ACTIVE' LIMIT 1
ON CONFLICT (room_code) DO NOTHING;

INSERT INTO class_rooms (education_level_id, academic_year_id, name, room_code, max_students)
SELECT el.id, ay.id, 'ม.6/1', 'M6-1', 35
FROM education_levels el, academic_years ay
WHERE el.code = 'M6' AND ay.status = 'ACTIVE' LIMIT 1
ON CONFLICT (room_code) DO NOTHING;

INSERT INTO class_rooms (education_level_id, academic_year_id, name, room_code, max_students)
SELECT el.id, ay.id, 'ม.6/2', 'M6-2', 35
FROM education_levels el, academic_years ay
WHERE el.code = 'M6' AND ay.status = 'ACTIVE' LIMIT 1
ON CONFLICT (room_code) DO NOTHING;

-- ============================================================
-- 5. SUBJECTS (วิชา)
-- ============================================================
INSERT INTO subjects (code, name, description, credit) VALUES
  ('CS101',   'วิทยาการคำนวณ 1',         'พื้นฐานการคำนวณและอัลกอริทึม',        1.0),
  ('CS102',   'วิทยาการคำนวณ 2',         'การเขียนโปรแกรม Python',               1.0),
  ('NET101',  'ระบบเครือข่ายคอมพิวเตอร์', 'โปรโตคอลและอุปกรณ์เครือข่าย',         1.0),
  ('DB101',   'ฐานข้อมูลเบื้องต้น',       'SQL และการออกแบบฐานข้อมูล',           1.0),
  ('WEB101',  'การพัฒนาเว็บเบื้องต้น',    'HTML, CSS, JavaScript',               1.0),
  ('SEC101',  'ความปลอดภัยระบบสารสนเทศ', 'Cybersecurity fundamentals',          1.0),
  ('MATH101', 'คณิตศาสตร์',              'คณิตศาสตร์สำหรับวิทยาการคอมพิวเตอร์', 1.0),
  ('ENG101',  'ภาษาอังกฤษ',             'English for IT',                       1.0)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 6. DEFAULT GRADE RULE
-- ============================================================
DO $$
DECLARE
  v_admin_id UUID;
  v_rule_id  UUID;
BEGIN
  -- Find existing admin user
  SELECT id INTO v_admin_id FROM profiles WHERE role = 'SUPER_ADMIN' LIMIT 1;

  -- Skip if no admin user yet — run this block again after creating admin
  IF v_admin_id IS NULL THEN
    RAISE NOTICE 'ℹ️  ไม่พบ Admin user — ข้ามส่วน Grade Rules';
    RAISE NOTICE '→ สร้าง Admin user ก่อน แล้วรันไฟล์ 004_grade_rules.sql';
    RETURN;
  END IF;

  -- Only insert if no default rule exists
  IF NOT EXISTS (SELECT 1 FROM grade_rules WHERE is_default = TRUE) THEN
    INSERT INTO grade_rules (name, created_by, is_default)
    VALUES ('เกณฑ์มาตรฐาน (4.0)', v_admin_id, TRUE)
    RETURNING id INTO v_rule_id;

    INSERT INTO grade_rule_items (grade_rule_id, min_score, max_score, grade, grade_point, sort_order) VALUES
      (v_rule_id,  0,  49.99, '0',   0.0, 8),
      (v_rule_id, 50,  54.99, '1',   1.0, 7),
      (v_rule_id, 55,  59.99, '1.5', 1.5, 6),
      (v_rule_id, 60,  64.99, '2',   2.0, 5),
      (v_rule_id, 65,  69.99, '2.5', 2.5, 4),
      (v_rule_id, 70,  74.99, '3',   3.0, 3),
      (v_rule_id, 75,  79.99, '3.5', 3.5, 2),
      (v_rule_id, 80, 100.00, '4',   4.0, 1);

    RAISE NOTICE '✅ สร้าง Grade Rule มาตรฐานสำเร็จ';
  ELSE
    RAISE NOTICE 'ℹ️  Grade Rule มีอยู่แล้ว — ข้าม';
  END IF;
END $$;

-- ============================================================
-- Done! ตรวจสอบข้อมูล
-- ============================================================
SELECT 'education_levels' AS table_name, COUNT(*) AS rows FROM education_levels
UNION ALL SELECT 'academic_years', COUNT(*) FROM academic_years
UNION ALL SELECT 'semesters', COUNT(*) FROM semesters
UNION ALL SELECT 'class_rooms', COUNT(*) FROM class_rooms
UNION ALL SELECT 'subjects', COUNT(*) FROM subjects
UNION ALL SELECT 'grade_rules', COUNT(*) FROM grade_rules
UNION ALL SELECT 'grade_rule_items', COUNT(*) FROM grade_rule_items
ORDER BY table_name;
