-- ============================================================
-- SQL Script: นำเข้ารายชื่อนักเรียนห้อง ปวช.1/11 (39 คน)
-- สามารถรันใน Supabase SQL Editor ได้ทันที
-- ============================================================

DO $$
DECLARE
  v_level_id UUID;
  v_room_id UUID;
  v_year_id UUID;
BEGIN
  -- 1. เลือกระดับ ปวช.1
  SELECT id INTO v_level_id FROM education_levels WHERE code = 'V1' OR name LIKE '%ปวช.1%' LIMIT 1;
  IF v_level_id IS NULL THEN
    INSERT INTO education_levels (name, code, sort_order) 
    VALUES ('ปวช.1', 'V1', 13) 
    RETURNING id INTO v_level_id;
  END IF;

  -- 2. หาปีการศึกษา ACTIVE
  SELECT id INTO v_year_id FROM academic_years WHERE status = 'ACTIVE' LIMIT 1;
  IF v_year_id IS NULL THEN
    SELECT id INTO v_year_id FROM academic_years ORDER BY created_at DESC LIMIT 1;
  END IF;

  -- 3. ตรวจสอบหรือสร้างห้องเรียน ปวช.1/11
  SELECT id INTO v_room_id FROM class_rooms WHERE name = 'ปวช.1/11' OR room_code = 'V1-11' LIMIT 1;
  IF v_room_id IS NULL THEN
    INSERT INTO class_rooms (education_level_id, academic_year_id, name, room_code, max_students)
    VALUES (v_level_id, v_year_id, 'ปวช.1/11', 'V1-11', 45)
    RETURNING id INTO v_room_id;
  END IF;

  -- 4. นำเข้านักเรียน 39 คน

  INSERT INTO students (student_code, first_name, last_name, nickname, education_level_id, class_room_id, status)
  VALUES ('69219010105', 'มนัชนันท์', 'แก้วผง', 'เมษา', v_level_id, v_room_id, 'ACTIVE')
  ON CONFLICT (student_code) DO UPDATE 
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      nickname = EXCLUDED.nickname,
      education_level_id = EXCLUDED.education_level_id,
      class_room_id = EXCLUDED.class_room_id,
      updated_at = NOW();

  INSERT INTO students (student_code, first_name, last_name, nickname, education_level_id, class_room_id, status)
  VALUES ('69219010240', 'เพชรา', 'โพธิ์พร', 'นัด', v_level_id, v_room_id, 'ACTIVE')
  ON CONFLICT (student_code) DO UPDATE 
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      nickname = EXCLUDED.nickname,
      education_level_id = EXCLUDED.education_level_id,
      class_room_id = EXCLUDED.class_room_id,
      updated_at = NOW();

  INSERT INTO students (student_code, first_name, last_name, nickname, education_level_id, class_room_id, status)
  VALUES ('69219010241', 'กรวิชญ์', 'นิลนนท์', 'ปีเตอร์', v_level_id, v_room_id, 'ACTIVE')
  ON CONFLICT (student_code) DO UPDATE 
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      nickname = EXCLUDED.nickname,
      education_level_id = EXCLUDED.education_level_id,
      class_room_id = EXCLUDED.class_room_id,
      updated_at = NOW();

  INSERT INTO students (student_code, first_name, last_name, nickname, education_level_id, class_room_id, status)
  VALUES ('69219010242', 'ปัฐวิชญ์', 'บุศรีคำ', 'เหนือ', v_level_id, v_room_id, 'ACTIVE')
  ON CONFLICT (student_code) DO UPDATE 
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      nickname = EXCLUDED.nickname,
      education_level_id = EXCLUDED.education_level_id,
      class_room_id = EXCLUDED.class_room_id,
      updated_at = NOW();

  INSERT INTO students (student_code, first_name, last_name, nickname, education_level_id, class_room_id, status)
  VALUES ('69219010243', 'ตั้งปณิธาน', 'ทองเจียว', 'เต', v_level_id, v_room_id, 'ACTIVE')
  ON CONFLICT (student_code) DO UPDATE 
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      nickname = EXCLUDED.nickname,
      education_level_id = EXCLUDED.education_level_id,
      class_room_id = EXCLUDED.class_room_id,
      updated_at = NOW();

  INSERT INTO students (student_code, first_name, last_name, nickname, education_level_id, class_room_id, status)
  VALUES ('69219010246', 'ณัฐภูมิ', 'คำผาย', 'ภูมิ', v_level_id, v_room_id, 'ACTIVE')
  ON CONFLICT (student_code) DO UPDATE 
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      nickname = EXCLUDED.nickname,
      education_level_id = EXCLUDED.education_level_id,
      class_room_id = EXCLUDED.class_room_id,
      updated_at = NOW();

  INSERT INTO students (student_code, first_name, last_name, nickname, education_level_id, class_room_id, status)
  VALUES ('69219010248', 'อานนท์', 'คำจันทร์ลา', 'อานน', v_level_id, v_room_id, 'ACTIVE')
  ON CONFLICT (student_code) DO UPDATE 
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      nickname = EXCLUDED.nickname,
      education_level_id = EXCLUDED.education_level_id,
      class_room_id = EXCLUDED.class_room_id,
      updated_at = NOW();

  INSERT INTO students (student_code, first_name, last_name, nickname, education_level_id, class_room_id, status)
  VALUES ('69219010249', 'นัทธ์หทัย', 'ผุยทา', 'ปาตี้', v_level_id, v_room_id, 'ACTIVE')
  ON CONFLICT (student_code) DO UPDATE 
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      nickname = EXCLUDED.nickname,
      education_level_id = EXCLUDED.education_level_id,
      class_room_id = EXCLUDED.class_room_id,
      updated_at = NOW();

  INSERT INTO students (student_code, first_name, last_name, nickname, education_level_id, class_room_id, status)
  VALUES ('69219010250', 'ธนชัย', 'โนนศรี', 'พี', v_level_id, v_room_id, 'ACTIVE')
  ON CONFLICT (student_code) DO UPDATE 
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      nickname = EXCLUDED.nickname,
      education_level_id = EXCLUDED.education_level_id,
      class_room_id = EXCLUDED.class_room_id,
      updated_at = NOW();

  INSERT INTO students (student_code, first_name, last_name, nickname, education_level_id, class_room_id, status)
  VALUES ('69219010252', 'กัญญาภรณ์', 'เนียมสนิท', 'ฟิว', v_level_id, v_room_id, 'ACTIVE')
  ON CONFLICT (student_code) DO UPDATE 
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      nickname = EXCLUDED.nickname,
      education_level_id = EXCLUDED.education_level_id,
      class_room_id = EXCLUDED.class_room_id,
      updated_at = NOW();

  INSERT INTO students (student_code, first_name, last_name, nickname, education_level_id, class_room_id, status)
  VALUES ('69219010254', 'กนก', 'คนตรง', 'ตง', v_level_id, v_room_id, 'ACTIVE')
  ON CONFLICT (student_code) DO UPDATE 
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      nickname = EXCLUDED.nickname,
      education_level_id = EXCLUDED.education_level_id,
      class_room_id = EXCLUDED.class_room_id,
      updated_at = NOW();

  INSERT INTO students (student_code, first_name, last_name, nickname, education_level_id, class_room_id, status)
  VALUES ('69219010255', 'ภาคภูมิ', 'บรรดิษฐ์', 'เจ', v_level_id, v_room_id, 'ACTIVE')
  ON CONFLICT (student_code) DO UPDATE 
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      nickname = EXCLUDED.nickname,
      education_level_id = EXCLUDED.education_level_id,
      class_room_id = EXCLUDED.class_room_id,
      updated_at = NOW();

  INSERT INTO students (student_code, first_name, last_name, nickname, education_level_id, class_room_id, status)
  VALUES ('69219010256', 'ชุติการญจน์', 'คนสารี', 'เฟิร์น', v_level_id, v_room_id, 'ACTIVE')
  ON CONFLICT (student_code) DO UPDATE 
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      nickname = EXCLUDED.nickname,
      education_level_id = EXCLUDED.education_level_id,
      class_room_id = EXCLUDED.class_room_id,
      updated_at = NOW();

  INSERT INTO students (student_code, first_name, last_name, nickname, education_level_id, class_room_id, status)
  VALUES ('69219010257', 'สรรเสริญ', 'นามบุตร', 'ลาภ', v_level_id, v_room_id, 'ACTIVE')
  ON CONFLICT (student_code) DO UPDATE 
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      nickname = EXCLUDED.nickname,
      education_level_id = EXCLUDED.education_level_id,
      class_room_id = EXCLUDED.class_room_id,
      updated_at = NOW();

  INSERT INTO students (student_code, first_name, last_name, nickname, education_level_id, class_room_id, status)
  VALUES ('69219010258', 'จตุรภัทร', 'พรไชยหาญ', 'นิว', v_level_id, v_room_id, 'ACTIVE')
  ON CONFLICT (student_code) DO UPDATE 
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      nickname = EXCLUDED.nickname,
      education_level_id = EXCLUDED.education_level_id,
      class_room_id = EXCLUDED.class_room_id,
      updated_at = NOW();

  INSERT INTO students (student_code, first_name, last_name, nickname, education_level_id, class_room_id, status)
  VALUES ('69219010259', 'จิรวัฒน์', 'สุภมาตย์', 'พีช', v_level_id, v_room_id, 'ACTIVE')
  ON CONFLICT (student_code) DO UPDATE 
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      nickname = EXCLUDED.nickname,
      education_level_id = EXCLUDED.education_level_id,
      class_room_id = EXCLUDED.class_room_id,
      updated_at = NOW();

  INSERT INTO students (student_code, first_name, last_name, nickname, education_level_id, class_room_id, status)
  VALUES ('69219010260', 'ภานุศิษฏ์', 'มุมทอง', 'โน้', v_level_id, v_room_id, 'ACTIVE')
  ON CONFLICT (student_code) DO UPDATE 
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      nickname = EXCLUDED.nickname,
      education_level_id = EXCLUDED.education_level_id,
      class_room_id = EXCLUDED.class_room_id,
      updated_at = NOW();

  INSERT INTO students (student_code, first_name, last_name, nickname, education_level_id, class_room_id, status)
  VALUES ('69219010261', 'สุชาวดี', 'ปรีกราน', 'แพรวา', v_level_id, v_room_id, 'ACTIVE')
  ON CONFLICT (student_code) DO UPDATE 
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      nickname = EXCLUDED.nickname,
      education_level_id = EXCLUDED.education_level_id,
      class_room_id = EXCLUDED.class_room_id,
      updated_at = NOW();

  INSERT INTO students (student_code, first_name, last_name, nickname, education_level_id, class_room_id, status)
  VALUES ('69219010262', 'ศิริพรรัตน์', 'เสนมา', 'เอิน', v_level_id, v_room_id, 'ACTIVE')
  ON CONFLICT (student_code) DO UPDATE 
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      nickname = EXCLUDED.nickname,
      education_level_id = EXCLUDED.education_level_id,
      class_room_id = EXCLUDED.class_room_id,
      updated_at = NOW();

  INSERT INTO students (student_code, first_name, last_name, nickname, education_level_id, class_room_id, status)
  VALUES ('69219010263', 'ดวงจันทร์', 'ก่อแก้ว', 'ขิ้ม', v_level_id, v_room_id, 'ACTIVE')
  ON CONFLICT (student_code) DO UPDATE 
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      nickname = EXCLUDED.nickname,
      education_level_id = EXCLUDED.education_level_id,
      class_room_id = EXCLUDED.class_room_id,
      updated_at = NOW();

  INSERT INTO students (student_code, first_name, last_name, nickname, education_level_id, class_room_id, status)
  VALUES ('69219010264', 'ภัทรพล', 'แพงแสง', 'กอง', v_level_id, v_room_id, 'ACTIVE')
  ON CONFLICT (student_code) DO UPDATE 
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      nickname = EXCLUDED.nickname,
      education_level_id = EXCLUDED.education_level_id,
      class_room_id = EXCLUDED.class_room_id,
      updated_at = NOW();

  INSERT INTO students (student_code, first_name, last_name, nickname, education_level_id, class_room_id, status)
  VALUES ('69219010265', 'อิสระพงษ์', 'ศรีสุระ', 'พายุ', v_level_id, v_room_id, 'ACTIVE')
  ON CONFLICT (student_code) DO UPDATE 
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      nickname = EXCLUDED.nickname,
      education_level_id = EXCLUDED.education_level_id,
      class_room_id = EXCLUDED.class_room_id,
      updated_at = NOW();

  INSERT INTO students (student_code, first_name, last_name, nickname, education_level_id, class_room_id, status)
  VALUES ('69219010266', 'ภูเบศ', 'นาคคง', 'หมูตั้ง', v_level_id, v_room_id, 'ACTIVE')
  ON CONFLICT (student_code) DO UPDATE 
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      nickname = EXCLUDED.nickname,
      education_level_id = EXCLUDED.education_level_id,
      class_room_id = EXCLUDED.class_room_id,
      updated_at = NOW();

  INSERT INTO students (student_code, first_name, last_name, nickname, education_level_id, class_room_id, status)
  VALUES ('69219010267', 'ธีระวัตร', 'มาสุ่ม', 'ธี', v_level_id, v_room_id, 'ACTIVE')
  ON CONFLICT (student_code) DO UPDATE 
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      nickname = EXCLUDED.nickname,
      education_level_id = EXCLUDED.education_level_id,
      class_room_id = EXCLUDED.class_room_id,
      updated_at = NOW();

  INSERT INTO students (student_code, first_name, last_name, nickname, education_level_id, class_room_id, status)
  VALUES ('69219010268', 'เพ็ญนภา', 'อุปนันท์', 'ทับทิม', v_level_id, v_room_id, 'ACTIVE')
  ON CONFLICT (student_code) DO UPDATE 
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      nickname = EXCLUDED.nickname,
      education_level_id = EXCLUDED.education_level_id,
      class_room_id = EXCLUDED.class_room_id,
      updated_at = NOW();

  INSERT INTO students (student_code, first_name, last_name, nickname, education_level_id, class_room_id, status)
  VALUES ('69219010269', 'วรรญวริน', 'อรุณพาศ', 'วิว', v_level_id, v_room_id, 'ACTIVE')
  ON CONFLICT (student_code) DO UPDATE 
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      nickname = EXCLUDED.nickname,
      education_level_id = EXCLUDED.education_level_id,
      class_room_id = EXCLUDED.class_room_id,
      updated_at = NOW();

  INSERT INTO students (student_code, first_name, last_name, nickname, education_level_id, class_room_id, status)
  VALUES ('69219010270', 'เนตรนภา', 'สมใจรัก', 'มิ้ง', v_level_id, v_room_id, 'ACTIVE')
  ON CONFLICT (student_code) DO UPDATE 
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      nickname = EXCLUDED.nickname,
      education_level_id = EXCLUDED.education_level_id,
      class_room_id = EXCLUDED.class_room_id,
      updated_at = NOW();

  INSERT INTO students (student_code, first_name, last_name, nickname, education_level_id, class_room_id, status)
  VALUES ('69219010271', 'ณัฐกรณ์', 'เจริญเนตร', 'ดิว', v_level_id, v_room_id, 'ACTIVE')
  ON CONFLICT (student_code) DO UPDATE 
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      nickname = EXCLUDED.nickname,
      education_level_id = EXCLUDED.education_level_id,
      class_room_id = EXCLUDED.class_room_id,
      updated_at = NOW();

  INSERT INTO students (student_code, first_name, last_name, nickname, education_level_id, class_room_id, status)
  VALUES ('69219010272', 'วชิรกรณ์', 'สารธิราช', 'ดีเชล', v_level_id, v_room_id, 'ACTIVE')
  ON CONFLICT (student_code) DO UPDATE 
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      nickname = EXCLUDED.nickname,
      education_level_id = EXCLUDED.education_level_id,
      class_room_id = EXCLUDED.class_room_id,
      updated_at = NOW();

  INSERT INTO students (student_code, first_name, last_name, nickname, education_level_id, class_room_id, status)
  VALUES ('69219010273', 'กฤษณะ', 'เคนานันต์', 'แบงค์', v_level_id, v_room_id, 'ACTIVE')
  ON CONFLICT (student_code) DO UPDATE 
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      nickname = EXCLUDED.nickname,
      education_level_id = EXCLUDED.education_level_id,
      class_room_id = EXCLUDED.class_room_id,
      updated_at = NOW();

  INSERT INTO students (student_code, first_name, last_name, nickname, education_level_id, class_room_id, status)
  VALUES ('69219010274', 'เจนจิรา', 'พันธุระ', 'หมิ้ว', v_level_id, v_room_id, 'ACTIVE')
  ON CONFLICT (student_code) DO UPDATE 
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      nickname = EXCLUDED.nickname,
      education_level_id = EXCLUDED.education_level_id,
      class_room_id = EXCLUDED.class_room_id,
      updated_at = NOW();

  INSERT INTO students (student_code, first_name, last_name, nickname, education_level_id, class_room_id, status)
  VALUES ('69219010275', 'ณัฐิดา', 'หมื่นทุม', 'ไอดิว', v_level_id, v_room_id, 'ACTIVE')
  ON CONFLICT (student_code) DO UPDATE 
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      nickname = EXCLUDED.nickname,
      education_level_id = EXCLUDED.education_level_id,
      class_room_id = EXCLUDED.class_room_id,
      updated_at = NOW();

  INSERT INTO students (student_code, first_name, last_name, nickname, education_level_id, class_room_id, status)
  VALUES ('69219010276', 'ณัฐวุฒิ', 'วัฒนาโยธิน', 'ตี๋', v_level_id, v_room_id, 'ACTIVE')
  ON CONFLICT (student_code) DO UPDATE 
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      nickname = EXCLUDED.nickname,
      education_level_id = EXCLUDED.education_level_id,
      class_room_id = EXCLUDED.class_room_id,
      updated_at = NOW();

  INSERT INTO students (student_code, first_name, last_name, nickname, education_level_id, class_room_id, status)
  VALUES ('69219010277', 'ปรัชญา', 'ยุระรัช', 'เอ้', v_level_id, v_room_id, 'ACTIVE')
  ON CONFLICT (student_code) DO UPDATE 
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      nickname = EXCLUDED.nickname,
      education_level_id = EXCLUDED.education_level_id,
      class_room_id = EXCLUDED.class_room_id,
      updated_at = NOW();

  INSERT INTO students (student_code, first_name, last_name, nickname, education_level_id, class_room_id, status)
  VALUES ('69219010278', 'ฆนาการ', 'วงษ์สัมฤทธิ์', 'บอส', v_level_id, v_room_id, 'ACTIVE')
  ON CONFLICT (student_code) DO UPDATE 
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      nickname = EXCLUDED.nickname,
      education_level_id = EXCLUDED.education_level_id,
      class_room_id = EXCLUDED.class_room_id,
      updated_at = NOW();

  INSERT INTO students (student_code, first_name, last_name, nickname, education_level_id, class_room_id, status)
  VALUES ('69219010280', 'ธีรศักดิ์', 'รอดสันเทียะ', 'ธันวา', v_level_id, v_room_id, 'ACTIVE')
  ON CONFLICT (student_code) DO UPDATE 
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      nickname = EXCLUDED.nickname,
      education_level_id = EXCLUDED.education_level_id,
      class_room_id = EXCLUDED.class_room_id,
      updated_at = NOW();

  INSERT INTO students (student_code, first_name, last_name, nickname, education_level_id, class_room_id, status)
  VALUES ('69219010281', 'สุรภา', 'เย็นสุข', 'สุ', v_level_id, v_room_id, 'ACTIVE')
  ON CONFLICT (student_code) DO UPDATE 
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      nickname = EXCLUDED.nickname,
      education_level_id = EXCLUDED.education_level_id,
      class_room_id = EXCLUDED.class_room_id,
      updated_at = NOW();

  INSERT INTO students (student_code, first_name, last_name, nickname, education_level_id, class_room_id, status)
  VALUES ('69219010282', 'ระพีพร', 'สวัสดิ์อารีย์', 'เตย', v_level_id, v_room_id, 'ACTIVE')
  ON CONFLICT (student_code) DO UPDATE 
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      nickname = EXCLUDED.nickname,
      education_level_id = EXCLUDED.education_level_id,
      class_room_id = EXCLUDED.class_room_id,
      updated_at = NOW();

  INSERT INTO students (student_code, first_name, last_name, nickname, education_level_id, class_room_id, status)
  VALUES ('69219010283', 'วัชระพงษ์', 'สะตะ', 'แคน', v_level_id, v_room_id, 'ACTIVE')
  ON CONFLICT (student_code) DO UPDATE 
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      nickname = EXCLUDED.nickname,
      education_level_id = EXCLUDED.education_level_id,
      class_room_id = EXCLUDED.class_room_id,
      updated_at = NOW();

  RAISE NOTICE '✅ นำเข้านักเรียน ปวช.1/11 จำนวน 39 คน สำเร็จเรียบร้อย!';
END $$;
