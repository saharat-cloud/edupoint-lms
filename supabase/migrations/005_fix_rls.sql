-- ============================================================
-- EduPoint LMS — Patch 005: Fix RLS Infinite Recursion
-- ============================================================

-- สร้างฟังก์ชัน SECURITY DEFINER เพื่อให้อ่านข้อมูลแบบข้าม RLS ได้
-- วิธีนี้จะช่วยแก้ปัญหา "Infinite Recursion" (Error 500) ที่เกิดจาก Policy ของ 2 Table วนลูปเรียกกันเอง

-- 1. Helper function ตรวจสอบว่าครูสอนวิชานี้หรือไม่ (ข้าม RLS teacher_subjects)
CREATE OR REPLACE FUNCTION check_is_subject_teacher(p_subject_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM teacher_subjects 
    WHERE teacher_id = auth.uid() AND subject_id = p_subject_id
  );
$$;

-- 2. Helper function ตรวจสอบว่าครูสอนห้องนี้หรือไม่ (ข้าม RLS teacher_subjects)
CREATE OR REPLACE FUNCTION check_is_room_teacher(p_class_room_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM teacher_subjects 
    WHERE teacher_id = auth.uid() AND class_room_id = p_class_room_id
  );
$$;

-- 3. Helper function ให้นักเรียนดูว่าตัวเองเรียนวิชานี้หรือไม่ (ข้าม RLS enrollments)
CREATE OR REPLACE FUNCTION check_is_enrolled(p_subject_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM enrollments 
    WHERE student_id = (SELECT id FROM students WHERE user_id = auth.uid() LIMIT 1) 
    AND subject_id = p_subject_id
  );
$$;

-- ============================================================
-- ลบ Policy เดิมที่มีปัญหาเรื่องการวนลูป
-- ============================================================
DROP POLICY IF EXISTS "Teachers view enrollments for their subjects" ON enrollments;
DROP POLICY IF EXISTS "Students can view teacher_subjects for their subjects" ON teacher_subjects;
DROP POLICY IF EXISTS "Teachers can view students in their rooms" ON students;
DROP POLICY IF EXISTS "Teachers can view their students" ON students;

-- ============================================================
-- สร้าง Policy ใหม่โดยใช้ฟังก์ชัน Helper ข้างต้น
-- ============================================================

-- ENROLLMENTS: ครูจะดูการลงทะเบียนได้ ถ้าครูเป็นคนสอนวิชานั้น
CREATE POLICY "Teachers view enrollments for their subjects" ON enrollments FOR SELECT USING (
  is_teacher() AND check_is_subject_teacher(subject_id)
);

-- TEACHER_SUBJECTS: นักเรียนดูได้ ถ้าตัวเองลงเรียนวิชานั้น
CREATE POLICY "Students can view teacher_subjects for their subjects" ON teacher_subjects FOR SELECT USING (
  check_is_enrolled(subject_id)
);

-- STUDENTS: ครูจะดูข้อมูลนักเรียนได้ ถ้าครูเป็นคนสอนในห้องเรียนนั้น
CREATE POLICY "Teachers can view students in their rooms" ON students FOR SELECT USING (
  is_teacher() AND check_is_room_teacher(class_room_id)
);

-- STUDENTS (แบบเชื่อม Enrollment): หากนักเรียนมาจากห้องอื่นแต่ลงวิชาที่สอน ก็ดูได้เช่นกัน
CREATE POLICY "Teachers can view their enrolled students" ON students FOR SELECT USING (
  is_teacher() AND EXISTS (
    SELECT 1 FROM enrollments e
    WHERE e.student_id = students.id AND check_is_subject_teacher(e.subject_id)
  )
);

-- รีโหลด Schema ของ PostgREST ให้แน่ใจว่าอัปเดตทันที
NOTIFY pgrst, 'reload schema';
