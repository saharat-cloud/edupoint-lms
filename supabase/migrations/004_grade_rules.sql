-- ============================================================
-- EduPoint LMS — Grade Rules (รันหลังสร้าง Admin User แล้ว)
-- ============================================================

DO $$
DECLARE
  v_admin_id UUID;
  v_rule_id  UUID;
BEGIN
  SELECT id INTO v_admin_id FROM profiles WHERE role = 'SUPER_ADMIN' LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'ยังไม่มี SUPER_ADMIN — กรุณาสร้าง Admin user ก่อน';
  END IF;

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

    RAISE NOTICE '✅ Grade Rule มาตรฐาน (4.0) สร้างสำเร็จ';
  ELSE
    RAISE NOTICE 'ℹ️  มี Grade Rule อยู่แล้ว — ข้าม';
  END IF;
END $$;

-- ตรวจสอบ
SELECT gr.name, gri.grade, gri.min_score, gri.max_score, gri.grade_point
FROM grade_rules gr
JOIN grade_rule_items gri ON gri.grade_rule_id = gr.id
ORDER BY gri.sort_order;
