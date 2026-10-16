-- ============================================================
-- EduPoint LMS — Seed Global Games
-- Creates 3 example games (IT, English, Math) with questions
-- ============================================================

DO $$
DECLARE
  v_admin_id UUID;
  v_game1_id UUID := uuid_generate_v4();
  v_game2_id UUID := uuid_generate_v4();
  v_game3_id UUID := uuid_generate_v4();
BEGIN
  -- Get the first Super Admin to assign as the creator
  SELECT id INTO v_admin_id FROM profiles WHERE role = 'SUPER_ADMIN' LIMIT 1;
  
  -- If no admin exists, fallback to any user (for safety in edge cases)
  IF v_admin_id IS NULL THEN
    SELECT id INTO v_admin_id FROM auth.users LIMIT 1;
  END IF;

  -- 1. Insert Games
  INSERT INTO games (id, title, description, category, max_score, pass_score, point_reward, status, created_by)
  VALUES 
    (v_game1_id, 'ความรู้รอบตัว IT', 'ทดสอบความรู้พื้นฐานเกี่ยวกับคอมพิวเตอร์และเครือข่าย', 'ทั่วไป', 100, 60, 50, 'PUBLISHED', v_admin_id),
    (v_game2_id, 'Basic English Vocabulary', 'ทบทวนคำศัพท์ภาษาอังกฤษที่ใช้ในชีวิตประจำวัน', 'ทั่วไป', 100, 50, 40, 'PUBLISHED', v_admin_id),
    (v_game3_id, 'คณิตศาสตร์คิดเร็ว', 'เกมบวก ลบ คูณ หาร จับเวลา', 'ทั่วไป', 100, 70, 60, 'PUBLISHED', v_admin_id)
  ON CONFLICT DO NOTHING;

  -- 2. Insert Game Questions
  -- Game 1: IT
  INSERT INTO game_questions (game_id, question, options, correct_answer, points, sort_order)
  VALUES
    (v_game1_id, 'ข้อใดคือหน้าที่หลักของ CPU?', '["หน่วยความจำหลัก", "ประมวลผลข้อมูล", "แสดงผลภาพ", "เก็บข้อมูลถาวร"]'::jsonb, 'ประมวลผลข้อมูล', 20, 1),
    (v_game1_id, 'อุปกรณ์ใดทำหน้าที่เชื่อมต่อเครือข่ายอินเทอร์เน็ต?', '["Monitor", "Keyboard", "Router", "Mouse"]'::jsonb, 'Router', 20, 2),
    (v_game1_id, 'ระบบปฏิบัติการใดพัฒนาโดย Microsoft?', '["Linux", "macOS", "Windows", "Android"]'::jsonb, 'Windows', 20, 3),
    (v_game1_id, 'RAM ย่อมาจากอะไร?', '["Random Access Memory", "Read Access Memory", "Run All Memory", "Read All Memory"]'::jsonb, 'Random Access Memory', 20, 4),
    (v_game1_id, 'พอร์ตที่นิยมใช้เสียบแฟลชไดร์ฟคือพอร์ตใด?', '["HDMI", "VGA", "USB", "LAN"]'::jsonb, 'USB', 20, 5);

  -- Game 2: English
  INSERT INTO game_questions (game_id, question, options, correct_answer, points, sort_order)
  VALUES
    (v_game2_id, 'What is the synonym of "Happy"?', '["Sad", "Joyful", "Angry", "Tired"]'::jsonb, 'Joyful', 20, 1),
    (v_game2_id, 'Which one is a fruit?', '["Carrot", "Potato", "Apple", "Onion"]'::jsonb, 'Apple', 20, 2),
    (v_game2_id, 'I _____ to the school every day.', '["go", "goes", "going", "gone"]'::jsonb, 'go', 20, 3),
    (v_game2_id, 'What color is the sky on a clear day?', '["Red", "Blue", "Green", "Yellow"]'::jsonb, 'Blue', 20, 4),
    (v_game2_id, 'How many days are there in a week?', '["5", "6", "7", "8"]'::jsonb, '7', 20, 5);

  -- Game 3: Math
  INSERT INTO game_questions (game_id, question, options, correct_answer, points, sort_order)
  VALUES
    (v_game3_id, '15 + 27 = ?', '["42", "41", "32", "52"]'::jsonb, '42', 20, 1),
    (v_game3_id, '9 x 8 = ?', '["64", "72", "81", "56"]'::jsonb, '72', 20, 2),
    (v_game3_id, '144 / 12 = ?', '["11", "12", "13", "14"]'::jsonb, '12', 20, 3),
    (v_game3_id, '(5 + 3) x 2 = ?', '["11", "13", "16", "20"]'::jsonb, '16', 20, 4),
    (v_game3_id, '25% ของ 200 คือเท่าไร?', '["25", "40", "50", "100"]'::jsonb, '50', 20, 5);

END $$;
