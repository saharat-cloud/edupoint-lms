-- ============================================================
-- EduPoint LMS — Full Database Schema
-- Run this in Supabase SQL Editor (once)
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'TEACHER', 'STUDENT', 'KIOSK');
CREATE TYPE student_status AS ENUM ('ACTIVE', 'INACTIVE', 'GRADUATED', 'TRANSFERRED');
CREATE TYPE academic_year_status AS ENUM ('ACTIVE', 'CLOSED', 'UPCOMING');
CREATE TYPE semester_status AS ENUM ('ACTIVE', 'CLOSED', 'UPCOMING');
CREATE TYPE enrollment_status AS ENUM ('ACTIVE', 'DROPPED', 'COMPLETED');
CREATE TYPE activity_status AS ENUM ('UPCOMING', 'ACTIVE', 'CLOSED');
CREATE TYPE assignment_status AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');
CREATE TYPE assignment_target_status AS ENUM ('ASSIGNED', 'COMPLETED', 'EXCUSED');
CREATE TYPE question_type AS ENUM ('TEXT', 'SHORT_ANSWER', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILE_UPLOAD', 'IMAGE_UPLOAD');
CREATE TYPE submission_status AS ENUM ('DRAFT', 'SUBMITTED', 'REVIEWING', 'RETURNED', 'RESUBMISSION_REQUIRED', 'GRADED');
CREATE TYPE conversation_status AS ENUM ('WAITING_TEACHER', 'WAITING_STUDENT', 'RESOLVED', 'CLOSED');
CREATE TYPE sender_role_type AS ENUM ('STUDENT', 'TEACHER', 'ADMIN');
CREATE TYPE notification_type AS ENUM (
  'ASSIGNMENT_NEW', 'ASSIGNMENT_DUE', 'SUBMISSION_RECEIVED', 'SUBMISSION_GRADED',
  'RESUBMISSION_REQUIRED', 'POINT_AWARDED', 'GAME_REWARD', 'NEW_MESSAGE', 'TEACHER_REPLY'
);
CREATE TYPE point_transaction_type AS ENUM ('EARN', 'BONUS', 'DEDUCTION', 'ADJUSTMENT', 'CORRECTION');
CREATE TYPE point_source_type AS ENUM ('ACTIVITY', 'ASSIGNMENT', 'GAME', 'QUIZ', 'BONUS', 'KIOSK', 'TEACHER_ADJUSTMENT');
CREATE TYPE point_formula_type AS ENUM ('LINEAR', 'THRESHOLD', 'CUSTOM');
CREATE TYPE late_penalty_type AS ENUM ('NONE', 'PERCENTAGE', 'FIXED');
CREATE TYPE audit_action AS ENUM (
  'CREATE', 'UPDATE', 'DELETE', 'PUBLISH', 'SUBMIT', 'GRADE', 'AWARD_POINT',
  'DEDUCT_POINT', 'CHECKIN', 'REGISTER_CARD', 'LOGIN', 'LOGOUT'
);
CREATE TYPE game_status AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- ============================================================
-- PROFILES (auth.users extension)
-- ============================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'STUDENT',
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- EDUCATION LEVELS
-- ============================================================

CREATE TABLE education_levels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ACADEMIC YEARS
-- ============================================================

CREATE TABLE academic_years (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status academic_year_status NOT NULL DEFAULT 'UPCOMING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SEMESTERS
-- ============================================================

CREATE TABLE semesters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status semester_status NOT NULL DEFAULT 'UPCOMING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CLASS ROOMS
-- ============================================================

CREATE TABLE class_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  education_level_id UUID NOT NULL REFERENCES education_levels(id) ON DELETE RESTRICT,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  room_code TEXT NOT NULL UNIQUE,
  max_students INT DEFAULT 40,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SUBJECTS
-- ============================================================

CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  credit NUMERIC(3,1) DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- STUDENTS
-- ============================================================

CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  card_number TEXT UNIQUE,
  student_code TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  nickname TEXT,
  education_level_id UUID REFERENCES education_levels(id) ON DELETE SET NULL,
  class_room_id UUID REFERENCES class_rooms(id) ON DELETE SET NULL,
  status student_status NOT NULL DEFAULT 'ACTIVE',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_students_card_number ON students(card_number);
CREATE INDEX idx_students_student_code ON students(student_code);
CREATE INDEX idx_students_class_room_id ON students(class_room_id);
CREATE INDEX idx_students_user_id ON students(user_id);

-- ============================================================
-- TEACHER SUBJECTS (ครูสอนวิชาอะไรในห้องไหน)
-- ============================================================

CREATE TABLE teacher_subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  class_room_id UUID NOT NULL REFERENCES class_rooms(id) ON DELETE CASCADE,
  semester_id UUID NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(teacher_id, subject_id, class_room_id, semester_id)
);

-- ============================================================
-- ENROLLMENTS (นักเรียนลงทะเบียนวิชา)
-- ============================================================

CREATE TABLE enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  class_room_id UUID NOT NULL REFERENCES class_rooms(id) ON DELETE CASCADE,
  semester_id UUID NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  status enrollment_status NOT NULL DEFAULT 'ACTIVE',
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, subject_id, semester_id)
);

-- ============================================================
-- ACTIVITIES
-- ============================================================

CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  default_points INT NOT NULL DEFAULT 0,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  status activity_status NOT NULL DEFAULT 'UPCOMING',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ACTIVITY PERMISSIONS (ใครได้รับอนุญาตเข้าร่วมกิจกรรม)
-- ============================================================

CREATE TABLE activity_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  points INT, -- override default_points if set
  status TEXT NOT NULL DEFAULT 'ALLOWED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(activity_id, student_id)
);

-- ============================================================
-- CHECKINS (Kiosk)
-- ============================================================

CREATE TABLE checkins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  card_number TEXT NOT NULL,
  points_awarded INT NOT NULL DEFAULT 0,
  kiosk_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(activity_id, student_id)
);

-- ============================================================
-- POINT TRANSACTIONS (Source of Truth)
-- ============================================================

CREATE TABLE point_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  points INT NOT NULL,
  transaction_type point_transaction_type NOT NULL,
  source_type point_source_type NOT NULL,
  source_id UUID,
  assignment_id UUID,        -- FK added via ALTER TABLE after assignments table is created
  game_id UUID,              -- FK added via ALTER TABLE after games table is created
  activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
  submission_id UUID,
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_point_transactions_student_id ON point_transactions(student_id);
CREATE INDEX idx_point_transactions_source_type ON point_transactions(source_type);

-- ============================================================
-- ASSIGNMENTS
-- ============================================================

CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  semester_id UUID NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  instructions TEXT,
  academic_full_score NUMERIC(6,2) NOT NULL DEFAULT 100,
  point_target INT NOT NULL DEFAULT 0,
  point_formula point_formula_type NOT NULL DEFAULT 'LINEAR',
  point_formula_config JSONB DEFAULT '{}',
  start_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  allow_late BOOLEAN NOT NULL DEFAULT FALSE,
  late_penalty_type late_penalty_type NOT NULL DEFAULT 'NONE',
  late_penalty_value NUMERIC(6,2) DEFAULT 0,
  max_submissions INT NOT NULL DEFAULT 1,
  status assignment_status NOT NULL DEFAULT 'DRAFT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assignments_teacher_id ON assignments(teacher_id);
CREATE INDEX idx_assignments_subject_id ON assignments(subject_id);
CREATE INDEX idx_assignments_status ON assignments(status);

-- ============================================================
-- ASSIGNMENT TARGETS
-- ============================================================

CREATE TABLE assignment_targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status assignment_target_status NOT NULL DEFAULT 'ASSIGNED',
  completed_at TIMESTAMPTZ,
  UNIQUE(assignment_id, student_id)
);

CREATE INDEX idx_assignment_targets_assignment_id ON assignment_targets(assignment_id);
CREATE INDEX idx_assignment_targets_student_id ON assignment_targets(student_id);

-- ============================================================
-- ASSIGNMENT QUESTIONS
-- ============================================================

CREATE TABLE assignment_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  question_type question_type NOT NULL DEFAULT 'TEXT',
  question_text TEXT NOT NULL,
  options JSONB DEFAULT '[]',
  correct_answer JSONB,
  points NUMERIC(6,2) NOT NULL DEFAULT 1,
  required BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ASSIGNMENT ATTACHMENTS (ไฟล์โจทย์จากครู)
-- ============================================================

CREATE TABLE assignment_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SUBMISSIONS
-- ============================================================

CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  attempt_number INT NOT NULL DEFAULT 1,
  status submission_status NOT NULL DEFAULT 'DRAFT',
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  academic_score NUMERIC(6,2),
  teacher_feedback TEXT,
  is_late BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_submissions_assignment_id ON submissions(assignment_id);
CREATE INDEX idx_submissions_student_id ON submissions(student_id);
CREATE INDEX idx_submissions_status ON submissions(status);

-- ============================================================
-- SUBMISSION ANSWERS
-- ============================================================

CREATE TABLE submission_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES assignment_questions(id) ON DELETE CASCADE,
  answer_text TEXT,
  answer_json JSONB,
  auto_score NUMERIC(6,2),
  teacher_score NUMERIC(6,2),
  teacher_feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SUBMISSION FILES
-- ============================================================

CREATE TABLE submission_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  question_id UUID REFERENCES assignment_questions(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ASSIGNMENT GRADES
-- ============================================================

CREATE TABLE assignment_grades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
  academic_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  full_score NUMERIC(6,2) NOT NULL DEFAULT 100,
  percentage NUMERIC(6,2),
  point_earned INT DEFAULT 0,
  graded_by UUID REFERENCES auth.users(id),
  graded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(assignment_id, student_id)
);

-- ============================================================
-- GRADE RULES (เกณฑ์การให้เกรด)
-- ============================================================

CREATE TABLE grade_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  semester_id UUID REFERENCES semesters(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE grade_rule_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grade_rule_id UUID NOT NULL REFERENCES grade_rules(id) ON DELETE CASCADE,
  min_score NUMERIC(6,2) NOT NULL,
  max_score NUMERIC(6,2) NOT NULL,
  grade TEXT NOT NULL,
  grade_point NUMERIC(3,1) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

-- ============================================================
-- GRADE WEIGHTS (น้ำหนักคะแนน)
-- ============================================================

CREATE TABLE grade_weights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  semester_id UUID NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  class_room_id UUID NOT NULL REFERENCES class_rooms(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES auth.users(id),
  assignment_weight NUMERIC(5,2) NOT NULL DEFAULT 40,
  quiz_weight NUMERIC(5,2) NOT NULL DEFAULT 10,
  midterm_weight NUMERIC(5,2) NOT NULL DEFAULT 20,
  final_weight NUMERIC(5,2) NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(subject_id, semester_id, class_room_id)
);

-- ============================================================
-- ASSIGNMENT CONVERSATIONS
-- ============================================================

CREATE TABLE assignment_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES auth.users(id),
  submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
  status conversation_status NOT NULL DEFAULT 'WAITING_TEACHER',
  last_message_at TIMESTAMPTZ,
  last_message_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversations_student_id ON assignment_conversations(student_id);
CREATE INDEX idx_conversations_teacher_id ON assignment_conversations(teacher_id);
CREATE INDEX idx_conversations_status ON assignment_conversations(status);

-- ============================================================
-- CONVERSATION MESSAGES
-- ============================================================

CREATE TABLE conversation_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES assignment_conversations(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES auth.users(id),
  sender_role sender_role_type NOT NULL,
  message TEXT NOT NULL,
  reply_to_message_id UUID REFERENCES conversation_messages(id) ON DELETE SET NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_id ON conversation_messages(conversation_id);

-- ============================================================
-- CONVERSATION ATTACHMENTS
-- ============================================================

CREATE TABLE conversation_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES conversation_messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  reference_type TEXT,
  reference_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);

-- ============================================================
-- GAMES
-- ============================================================

CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  thumbnail_url TEXT,
  max_score INT NOT NULL DEFAULT 100,
  pass_score INT NOT NULL DEFAULT 60,
  point_reward INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  cooldown_seconds INT NOT NULL DEFAULT 3600,
  status game_status NOT NULL DEFAULT 'DRAFT',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- GAME QUESTIONS
-- ============================================================

CREATE TABLE game_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]',
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  points INT NOT NULL DEFAULT 10,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- GAME ATTEMPTS
-- ============================================================

CREATE TABLE game_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  answers JSONB DEFAULT '{}',
  score INT,
  percentage NUMERIC(5,2),
  passed BOOLEAN,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  reward_given BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_game_attempts_student_id ON game_attempts(student_id);
CREATE INDEX idx_game_attempts_game_id ON game_attempts(game_id);

-- ============================================================
-- GAME REWARDS
-- ============================================================

CREATE TABLE game_rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  attempt_id UUID NOT NULL REFERENCES game_attempts(id) ON DELETE CASCADE,
  points INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(attempt_id) -- one reward per attempt
);

-- ============================================================
-- AUDIT LOGS
-- ============================================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action audit_action NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);

-- Fix forward references in point_transactions
ALTER TABLE point_transactions ADD CONSTRAINT fk_pt_assignment FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE SET NULL;
ALTER TABLE point_transactions ADD CONSTRAINT fk_pt_game FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE SET NULL;

-- ============================================================
-- VIEWS
-- ============================================================

-- Student total points (always calculated from transactions)
CREATE OR REPLACE VIEW student_total_points AS
SELECT
  student_id,
  COALESCE(SUM(points), 0) AS total_points,
  COUNT(*) FILTER (WHERE transaction_type = 'EARN') AS earn_count,
  COUNT(*) FILTER (WHERE transaction_type = 'DEDUCTION') AS deduction_count,
  MAX(created_at) AS last_transaction_at
FROM point_transactions
GROUP BY student_id;

-- Student assignment summary
CREATE OR REPLACE VIEW student_assignment_summary AS
SELECT
  at2.student_id,
  at2.assignment_id,
  at2.status AS target_status,
  s.id AS submission_id,
  s.status AS submission_status,
  s.attempt_number,
  s.submitted_at,
  s.academic_score,
  s.is_late,
  ag.point_earned
FROM assignment_targets at2
LEFT JOIN submissions s ON s.assignment_id = at2.assignment_id
  AND s.student_id = at2.student_id
  AND s.attempt_number = (
    SELECT MAX(s2.attempt_number) FROM submissions s2
    WHERE s2.assignment_id = at2.assignment_id AND s2.student_id = at2.student_id
  )
LEFT JOIN assignment_grades ag ON ag.assignment_id = at2.assignment_id AND ag.student_id = at2.student_id;

-- ============================================================
-- RPC FUNCTIONS
-- ============================================================

-- ============================================================
-- award_kiosk_point: Called by Kiosk to check-in and award point
-- ============================================================
CREATE OR REPLACE FUNCTION award_kiosk_point(
  p_card_number TEXT,
  p_activity_id UUID,
  p_kiosk_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student students%ROWTYPE;
  v_activity activities%ROWTYPE;
  v_permission activity_permissions%ROWTYPE;
  v_checkin checkins%ROWTYPE;
  v_points INT;
  v_checkin_id UUID;
  v_transaction_id UUID;
BEGIN
  -- 1. Find student by card number
  SELECT * INTO v_student FROM students WHERE card_number = p_card_number AND status = 'ACTIVE';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'code', 'STUDENT_NOT_FOUND', 'message', 'ไม่พบหมายเลขบัตรนี้ในระบบ');
  END IF;

  -- 2. Find activity
  SELECT * INTO v_activity FROM activities WHERE id = p_activity_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'code', 'ACTIVITY_NOT_FOUND', 'message', 'ไม่พบกิจกรรม');
  END IF;

  -- 3. Check activity is active
  IF v_activity.status != 'ACTIVE' THEN
    RETURN jsonb_build_object('success', FALSE, 'code', 'ACTIVITY_INACTIVE', 'message', 'กิจกรรมยังไม่เปิดหรือปิดแล้ว');
  END IF;

  -- 4. Check time window
  IF v_activity.start_at IS NOT NULL AND NOW() < v_activity.start_at THEN
    RETURN jsonb_build_object('success', FALSE, 'code', 'ACTIVITY_NOT_STARTED', 'message', 'กิจกรรมยังไม่เริ่ม');
  END IF;
  IF v_activity.end_at IS NOT NULL AND NOW() > v_activity.end_at THEN
    RETURN jsonb_build_object('success', FALSE, 'code', 'ACTIVITY_ENDED', 'message', 'กิจกรรมสิ้นสุดแล้ว');
  END IF;

  -- 5. Check permission
  SELECT * INTO v_permission FROM activity_permissions
  WHERE activity_id = p_activity_id AND student_id = v_student.id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'code', 'NO_PERMISSION', 'message', 'นักเรียนไม่มีสิทธิ์เข้าร่วมกิจกรรมนี้');
  END IF;
  IF v_permission.status != 'ALLOWED' THEN
    RETURN jsonb_build_object('success', FALSE, 'code', 'PERMISSION_DENIED', 'message', 'ไม่ได้รับอนุญาต');
  END IF;

  -- 6. Check duplicate
  SELECT * INTO v_checkin FROM checkins WHERE activity_id = p_activity_id AND student_id = v_student.id;
  IF FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'code', 'ALREADY_CHECKED_IN', 'message', 'นักเรียนได้รับ Point จากกิจกรรมนี้แล้ว');
  END IF;

  -- 7. Determine points
  v_points := COALESCE(v_permission.points, v_activity.default_points);

  -- 8. Insert checkin + transaction atomically
  INSERT INTO checkins (student_id, activity_id, card_number, points_awarded, kiosk_id)
  VALUES (v_student.id, p_activity_id, p_card_number, v_points, p_kiosk_id)
  RETURNING id INTO v_checkin_id;

  INSERT INTO point_transactions (
    student_id, points, transaction_type, source_type, source_id, activity_id, note, created_by
  ) VALUES (
    v_student.id, v_points, 'EARN', 'KIOSK', v_checkin_id, p_activity_id,
    'Kiosk check-in: ' || v_activity.name, NULL
  ) RETURNING id INTO v_transaction_id;

  -- 9. Insert notification for student (if they have a user account)
  IF v_student.user_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
    VALUES (
      v_student.user_id, 'POINT_AWARDED',
      'ได้รับ Point จากกิจกรรม!',
      'คุณได้รับ ' || v_points || ' Point จากกิจกรรม: ' || v_activity.name,
      'checkin', v_checkin_id
    );
  END IF;

  -- 10. Get total points
  RETURN jsonb_build_object(
    'success', TRUE,
    'code', 'SUCCESS',
    'student_id', v_student.id,
    'student_name', v_student.first_name || ' ' || v_student.last_name,
    'nickname', v_student.nickname,
    'points_awarded', v_points,
    'total_points', (SELECT COALESCE(SUM(points), 0) FROM point_transactions WHERE student_id = v_student.id),
    'activity_name', v_activity.name,
    'checkin_id', v_checkin_id
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', FALSE, 'code', 'ALREADY_CHECKED_IN', 'message', 'นักเรียนได้รับ Point จากกิจกรรมนี้แล้ว');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', FALSE, 'code', 'ERROR', 'message', SQLERRM);
END;
$$;

-- ============================================================
-- award_game_point: Server-side game score validation & reward
-- ============================================================
CREATE OR REPLACE FUNCTION award_game_point(
  p_attempt_id UUID,
  p_student_id UUID,
  p_answers JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt game_attempts%ROWTYPE;
  v_game games%ROWTYPE;
  v_question game_questions%ROWTYPE;
  v_score INT := 0;
  v_max_score INT := 0;
  v_answer TEXT;
  v_total_points BIGINT;
  v_reward_id UUID;
  v_attempt_count INT;
  v_last_attempt_time TIMESTAMPTZ;
BEGIN
  -- 1. Validate attempt belongs to student
  SELECT * INTO v_attempt FROM game_attempts
  WHERE id = p_attempt_id AND student_id = p_student_id AND completed_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'code', 'INVALID_ATTEMPT', 'message', 'ไม่พบการเล่นนี้');
  END IF;

  -- 2. Get game
  SELECT * INTO v_game FROM games WHERE id = v_attempt.game_id AND status = 'PUBLISHED';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'code', 'GAME_NOT_FOUND', 'message', 'ไม่พบเกม');
  END IF;

  -- 3. Check max attempts
  SELECT COUNT(*) INTO v_attempt_count FROM game_attempts
  WHERE game_id = v_game.id AND student_id = p_student_id AND completed_at IS NOT NULL;
  IF v_attempt_count >= v_game.max_attempts THEN
    RETURN jsonb_build_object('success', FALSE, 'code', 'MAX_ATTEMPTS', 'message', 'ครบจำนวนครั้งที่อนุญาตแล้ว');
  END IF;

  -- 4. Check cooldown
  SELECT MAX(completed_at) INTO v_last_attempt_time FROM game_attempts
  WHERE game_id = v_game.id AND student_id = p_student_id AND completed_at IS NOT NULL;
  IF v_last_attempt_time IS NOT NULL AND
     EXTRACT(EPOCH FROM (NOW() - v_last_attempt_time)) < v_game.cooldown_seconds THEN
    RETURN jsonb_build_object('success', FALSE, 'code', 'COOLDOWN', 'message', 'กรุณารอก่อนเล่นใหม่');
  END IF;

  -- 5. Server-side score calculation
  FOR v_question IN SELECT * FROM game_questions WHERE game_id = v_game.id LOOP
    v_max_score := v_max_score + v_question.points;
    v_answer := p_answers ->> v_question.id::TEXT;
    IF v_answer IS NOT NULL AND LOWER(TRIM(v_answer)) = LOWER(TRIM(v_question.correct_answer)) THEN
      v_score := v_score + v_question.points;
    END IF;
  END LOOP;

  -- 6. Mark attempt complete
  UPDATE game_attempts SET
    answers = p_answers,
    score = v_score,
    percentage = CASE WHEN v_max_score > 0 THEN (v_score::NUMERIC / v_max_score * 100) ELSE 0 END,
    passed = (v_score >= v_game.pass_score),
    completed_at = NOW()
  WHERE id = p_attempt_id;

  -- 7. Award points if passed and not rewarded yet
  IF v_score >= v_game.pass_score AND v_game.point_reward > 0 THEN
    -- Check for existing reward for this attempt
    IF NOT EXISTS (SELECT 1 FROM game_rewards WHERE attempt_id = p_attempt_id) THEN
      INSERT INTO game_rewards (game_id, student_id, attempt_id, points)
      VALUES (v_game.id, p_student_id, p_attempt_id, v_game.point_reward)
      RETURNING id INTO v_reward_id;

      INSERT INTO point_transactions (
        student_id, points, transaction_type, source_type, source_id, game_id, note
      ) VALUES (
        p_student_id, v_game.point_reward, 'EARN', 'GAME', p_attempt_id, v_game.id,
        'เกม: ' || v_game.title
      );

      -- Notify student
      SELECT user_id INTO v_attempt.student_id FROM students WHERE id = p_student_id;
      IF v_attempt.student_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
        SELECT user_id, 'GAME_REWARD', 'ได้รับ Point จากเกม!',
          'เล่นเกม ' || v_game.title || ' สำเร็จ! ได้รับ ' || v_game.point_reward || ' Point',
          'game', v_game.id
        FROM students WHERE id = p_student_id AND user_id IS NOT NULL;
      END IF;

      UPDATE game_attempts SET reward_given = TRUE WHERE id = p_attempt_id;
    END IF;
  END IF;

  SELECT COALESCE(SUM(points), 0) INTO v_total_points FROM point_transactions WHERE student_id = p_student_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'score', v_score,
    'max_score', COALESCE(v_max_score, v_game.max_score),
    'percentage', CASE WHEN v_max_score > 0 THEN ROUND((v_score::NUMERIC / v_max_score * 100)::NUMERIC, 1) ELSE 0 END,
    'passed', (v_score >= v_game.pass_score),
    'points_awarded', CASE WHEN v_score >= v_game.pass_score THEN v_game.point_reward ELSE 0 END,
    'total_points', v_total_points
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', TRUE, 'code', 'ALREADY_REWARDED', 'message', 'ได้รับ Point จากการเล่นนี้แล้ว');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', FALSE, 'code', 'ERROR', 'message', SQLERRM);
END;
$$;

-- ============================================================
-- award_assignment_point: Teacher awards point after grading
-- ============================================================
CREATE OR REPLACE FUNCTION award_assignment_point(
  p_submission_id UUID,
  p_academic_score NUMERIC,
  p_teacher_feedback TEXT,
  p_question_scores JSONB DEFAULT '{}',
  p_new_status submission_status DEFAULT 'GRADED'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_submission submissions%ROWTYPE;
  v_assignment assignments%ROWTYPE;
  v_student students%ROWTYPE;
  v_existing_grade assignment_grades%ROWTYPE;
  v_points_earned INT := 0;
  v_percentage NUMERIC;
  v_caller_id UUID;
  v_question RECORD;
  v_q_score NUMERIC;
BEGIN
  -- Get calling user
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'code', 'UNAUTHORIZED');
  END IF;

  -- Get submission
  SELECT * INTO v_submission FROM submissions WHERE id = p_submission_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'code', 'SUBMISSION_NOT_FOUND');
  END IF;

  -- Get assignment
  SELECT * INTO v_assignment FROM assignments WHERE id = v_submission.assignment_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'code', 'ASSIGNMENT_NOT_FOUND');
  END IF;

  -- Verify teacher owns this assignment
  IF v_assignment.teacher_id != v_caller_id THEN
    -- Check if caller is admin
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_caller_id AND role IN ('SUPER_ADMIN')) THEN
      RETURN jsonb_build_object('success', FALSE, 'code', 'FORBIDDEN');
    END IF;
  END IF;

  -- Get student
  SELECT * INTO v_student FROM students WHERE id = v_submission.student_id;

  -- Calculate percentage
  v_percentage := CASE
    WHEN v_assignment.academic_full_score > 0
    THEN ROUND((p_academic_score / v_assignment.academic_full_score * 100)::NUMERIC, 2)
    ELSE 0
  END;

  -- Calculate points based on formula
  IF v_assignment.point_target > 0 THEN
    DECLARE
      v_student_points INT;
      v_config JSONB;
    BEGIN
      -- Get student's current points for this assignment context
      v_student_points := COALESCE(
        (SELECT SUM(points) FROM point_transactions
         WHERE student_id = v_student.id AND assignment_id = v_assignment.id),
        0
      );

      v_config := COALESCE(v_assignment.point_formula_config, '{}'::JSONB);

      IF v_assignment.point_formula = 'LINEAR' THEN
        v_points_earned := ROUND(
          LEAST(v_student_points::NUMERIC / v_assignment.point_target, 1) * v_assignment.academic_full_score
        );
      ELSIF v_assignment.point_formula = 'THRESHOLD' THEN
        -- Threshold from config array [{min, max, score}]
        DECLARE v_threshold JSONB; BEGIN
          FOR v_threshold IN SELECT * FROM jsonb_array_elements(v_config->'thresholds') LOOP
            IF v_student_points >= (v_threshold->>'min')::INT AND
               (v_threshold->>'max' IS NULL OR v_student_points <= (v_threshold->>'max')::INT) THEN
              v_points_earned := (v_threshold->>'score')::INT;
            END IF;
          END LOOP;
        END;
      ELSE
        v_points_earned := 0;
      END IF;
    END;
  END IF;

  -- Update per-question scores if provided
  IF p_question_scores IS NOT NULL AND p_question_scores != '{}'::JSONB THEN
    FOR v_question IN SELECT * FROM jsonb_each(p_question_scores) LOOP
      v_q_score := (v_question.value->>'score')::NUMERIC;
      UPDATE submission_answers
      SET teacher_score = v_q_score,
          teacher_feedback = v_question.value->>'feedback',
          updated_at = NOW()
      WHERE submission_id = p_submission_id AND question_id = v_question.key::UUID;
    END LOOP;
  END IF;

  -- Update submission
  UPDATE submissions SET
    status = p_new_status,
    academic_score = p_academic_score,
    teacher_feedback = p_teacher_feedback,
    reviewed_at = NOW(),
    reviewed_by = v_caller_id,
    updated_at = NOW()
  WHERE id = p_submission_id;

  -- Upsert assignment grade
  INSERT INTO assignment_grades (
    assignment_id, student_id, submission_id, academic_score, full_score, percentage, point_earned, graded_by, graded_at
  ) VALUES (
    v_assignment.id, v_student.id, p_submission_id, p_academic_score,
    v_assignment.academic_full_score, v_percentage, v_points_earned, v_caller_id, NOW()
  )
  ON CONFLICT (assignment_id, student_id) DO UPDATE SET
    submission_id = EXCLUDED.submission_id,
    academic_score = EXCLUDED.academic_score,
    percentage = EXCLUDED.percentage,
    point_earned = EXCLUDED.point_earned,
    graded_by = EXCLUDED.graded_by,
    graded_at = EXCLUDED.graded_at,
    updated_at = NOW();

  -- Record point transaction (award points from grading)
  IF v_points_earned > 0 THEN
    -- Check no duplicate grading point for this submission
    IF NOT EXISTS (
      SELECT 1 FROM point_transactions
      WHERE submission_id = p_submission_id AND source_type = 'ASSIGNMENT'
    ) THEN
      INSERT INTO point_transactions (
        student_id, points, transaction_type, source_type, source_id,
        assignment_id, submission_id, note, created_by
      ) VALUES (
        v_student.id, v_points_earned, 'EARN', 'ASSIGNMENT', p_submission_id,
        v_assignment.id, p_submission_id,
        'ตรวจงาน: ' || v_assignment.title, v_caller_id
      );
    END IF;
  END IF;

  -- Update assignment target
  IF p_new_status = 'GRADED' THEN
    UPDATE assignment_targets SET
      status = 'COMPLETED',
      completed_at = NOW()
    WHERE assignment_id = v_assignment.id AND student_id = v_student.id;
  END IF;

  -- Notify student
  IF v_student.user_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
    VALUES (
      v_student.user_id,
      CASE WHEN p_new_status = 'RESUBMISSION_REQUIRED' THEN 'RESUBMISSION_REQUIRED' ELSE 'SUBMISSION_GRADED' END,
      CASE WHEN p_new_status = 'RESUBMISSION_REQUIRED' THEN 'ครูขอให้แก้ไขงาน' ELSE 'งานของคุณได้รับการตรวจแล้ว' END,
      CASE WHEN p_new_status = 'RESUBMISSION_REQUIRED'
        THEN 'กรุณาแก้ไขและส่งงานใหม่: ' || v_assignment.title
        ELSE 'คะแนน: ' || p_academic_score || '/' || v_assignment.academic_full_score || ' - ' || v_assignment.title
      END,
      'submission', p_submission_id
    );
  END IF;

  -- Audit
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data)
  VALUES (v_caller_id, 'GRADE', 'submission', p_submission_id,
    jsonb_build_object('score', p_academic_score, 'status', p_new_status));

  RETURN jsonb_build_object(
    'success', TRUE,
    'academic_score', p_academic_score,
    'percentage', v_percentage,
    'points_earned', v_points_earned,
    'status', p_new_status
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', FALSE, 'code', 'ERROR', 'message', SQLERRM);
END;
$$;

-- ============================================================
-- get_gradebook: Returns gradebook data for a subject/semester/room
-- ============================================================
CREATE OR REPLACE FUNCTION get_gradebook(
  p_subject_id UUID,
  p_semester_id UUID,
  p_class_room_id UUID
)
RETURNS TABLE (
  student_id UUID,
  student_code TEXT,
  first_name TEXT,
  last_name TEXT,
  nickname TEXT,
  assignment_data JSONB,
  total_score NUMERIC,
  grade TEXT,
  grade_point NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  RETURN QUERY
  WITH enrolled_students AS (
    SELECT s.id, s.student_code, s.first_name, s.last_name, s.nickname
    FROM students s
    INNER JOIN enrollments e ON e.student_id = s.id
    WHERE e.subject_id = p_subject_id
      AND e.semester_id = p_semester_id
      AND e.class_room_id = p_class_room_id
      AND s.status = 'ACTIVE'
  ),
  student_grades AS (
    SELECT
      es.id,
      es.student_code,
      es.first_name,
      es.last_name,
      es.nickname,
      jsonb_object_agg(
        ag.assignment_id::TEXT,
        jsonb_build_object(
          'score', ag.academic_score,
          'full_score', ag.full_score,
          'percentage', ag.percentage
        )
      ) FILTER (WHERE ag.assignment_id IS NOT NULL) AS assignment_data,
      COALESCE(AVG(ag.percentage), 0) AS avg_percentage
    FROM enrolled_students es
    LEFT JOIN assignment_grades ag ON ag.student_id = es.id
    LEFT JOIN assignments a ON a.id = ag.assignment_id
      AND a.subject_id = p_subject_id
      AND a.semester_id = p_semester_id
    GROUP BY es.id, es.student_code, es.first_name, es.last_name, es.nickname
  )
  SELECT
    sg.id,
    sg.student_code,
    sg.first_name,
    sg.last_name,
    sg.nickname,
    COALESCE(sg.assignment_data, '{}'::JSONB),
    ROUND(sg.avg_percentage::NUMERIC, 2),
    COALESCE(gri.grade, 'F'),
    COALESCE(gri.grade_point, 0)
  FROM student_grades sg
  LEFT JOIN grade_rules gr ON gr.subject_id = p_subject_id
    AND gr.semester_id = p_semester_id
    AND gr.is_default = TRUE
  LEFT JOIN grade_rule_items gri ON gri.grade_rule_id = gr.id
    AND sg.avg_percentage >= gri.min_score
    AND sg.avg_percentage <= gri.max_score
  ORDER BY sg.student_code;
END;
$$;

-- ============================================================
-- assign_to_room: Bulk assign assignment to all students in room
-- ============================================================
CREATE OR REPLACE FUNCTION assign_to_room(
  p_assignment_id UUID,
  p_class_room_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment assignments%ROWTYPE;
  v_student students%ROWTYPE;
  v_count INT := 0;
  v_caller_id UUID;
BEGIN
  v_caller_id := auth.uid();

  SELECT * INTO v_assignment FROM assignments WHERE id = p_assignment_id;
  IF NOT FOUND OR v_assignment.teacher_id != v_caller_id THEN
    -- Allow admin too
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_caller_id AND role = 'SUPER_ADMIN') THEN
      RETURN jsonb_build_object('success', FALSE, 'code', 'FORBIDDEN');
    END IF;
  END IF;

  FOR v_student IN
    SELECT s.* FROM students s WHERE s.class_room_id = p_class_room_id AND s.status = 'ACTIVE'
  LOOP
    INSERT INTO assignment_targets (assignment_id, student_id)
    VALUES (p_assignment_id, v_student.id)
    ON CONFLICT (assignment_id, student_id) DO NOTHING;
    v_count := v_count + 1;
  END LOOP;

  -- Notify students
  FOR v_student IN
    SELECT s.* FROM students s WHERE s.class_room_id = p_class_room_id AND s.status = 'ACTIVE' AND s.user_id IS NOT NULL
  LOOP
    INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
    VALUES (
      v_student.user_id, 'ASSIGNMENT_NEW',
      'มีงานใหม่: ' || v_assignment.title,
      'ครูมอบหมายงาน: ' || v_assignment.title,
      'assignment', p_assignment_id
    );
  END LOOP;

  RETURN jsonb_build_object('success', TRUE, 'assigned_count', v_count);
END;
$$;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-create profile on user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'STUDENT')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER set_updated_at_profiles BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_academic_years BEFORE UPDATE ON academic_years FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_semesters BEFORE UPDATE ON semesters FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_class_rooms BEFORE UPDATE ON class_rooms FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_subjects BEFORE UPDATE ON subjects FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_students BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_assignments BEFORE UPDATE ON assignments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_submissions BEFORE UPDATE ON submissions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_conversations BEFORE UPDATE ON assignment_conversations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_games BEFORE UPDATE ON games FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE education_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_rule_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper: check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'SUPER_ADMIN');
$$;

-- Helper: check if current user is teacher
CREATE OR REPLACE FUNCTION is_teacher()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('TEACHER', 'SUPER_ADMIN'));
$$;

-- Helper: get student id for current user
CREATE OR REPLACE FUNCTION my_student_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT id FROM students WHERE user_id = auth.uid() LIMIT 1;
$$;

-- PROFILES
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT USING (is_admin());
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Admins can manage all profiles" ON profiles FOR ALL USING (is_admin());

-- EDUCATION LEVELS (public read)
CREATE POLICY "Anyone authenticated can read education_levels" ON education_levels FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Admins manage education_levels" ON education_levels FOR ALL USING (is_admin());

-- ACADEMIC YEARS (public read)
CREATE POLICY "Anyone authenticated can read academic_years" ON academic_years FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Admins manage academic_years" ON academic_years FOR ALL USING (is_admin());

-- SEMESTERS (public read)
CREATE POLICY "Anyone authenticated can read semesters" ON semesters FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Admins manage semesters" ON semesters FOR ALL USING (is_admin());

-- CLASS ROOMS (public read)
CREATE POLICY "Anyone authenticated can read class_rooms" ON class_rooms FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Admins manage class_rooms" ON class_rooms FOR ALL USING (is_admin());

-- SUBJECTS (public read)
CREATE POLICY "Anyone authenticated can read subjects" ON subjects FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Admins manage subjects" ON subjects FOR ALL USING (is_admin());

-- TEACHER SUBJECTS
CREATE POLICY "Teachers can view their subjects" ON teacher_subjects FOR SELECT USING (teacher_id = auth.uid() OR is_admin());
CREATE POLICY "Admins manage teacher_subjects" ON teacher_subjects FOR ALL USING (is_admin());
CREATE POLICY "Students can view teacher_subjects for their subjects" ON teacher_subjects FOR SELECT USING (
  EXISTS (SELECT 1 FROM enrollments e WHERE e.student_id = my_student_id() AND e.subject_id = teacher_subjects.subject_id)
);

-- STUDENTS
CREATE POLICY "Students can view own record" ON students FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Teachers can view their students" ON students FOR SELECT USING (
  is_teacher() AND EXISTS (
    SELECT 1 FROM teacher_subjects ts
    INNER JOIN enrollments e ON e.class_room_id = ts.class_room_id AND e.student_id = students.id
    WHERE ts.teacher_id = auth.uid()
  )
);
CREATE POLICY "Admins manage students" ON students FOR ALL USING (is_admin());
CREATE POLICY "Teachers can view students in their rooms" ON students FOR SELECT USING (
  is_teacher() AND class_room_id IN (
    SELECT class_room_id FROM teacher_subjects WHERE teacher_id = auth.uid()
  )
);

-- ENROLLMENTS
CREATE POLICY "Students view own enrollments" ON enrollments FOR SELECT USING (student_id = my_student_id());
CREATE POLICY "Teachers view enrollments for their subjects" ON enrollments FOR SELECT USING (
  is_teacher() AND EXISTS (
    SELECT 1 FROM teacher_subjects ts
    WHERE ts.teacher_id = auth.uid() AND ts.subject_id = enrollments.subject_id
  )
);
CREATE POLICY "Admins manage enrollments" ON enrollments FOR ALL USING (is_admin());

-- ACTIVITIES
CREATE POLICY "Authenticated can view active activities" ON activities FOR SELECT TO authenticated USING (status = 'ACTIVE' OR is_teacher());
CREATE POLICY "Teachers manage activities" ON activities FOR ALL USING (is_teacher());

-- ACTIVITY PERMISSIONS
CREATE POLICY "Students view own activity permissions" ON activity_permissions FOR SELECT USING (student_id = my_student_id());
CREATE POLICY "Teachers manage activity permissions" ON activity_permissions FOR ALL USING (is_teacher());

-- CHECKINS
CREATE POLICY "Students view own checkins" ON checkins FOR SELECT USING (student_id = my_student_id());
CREATE POLICY "Teachers view all checkins" ON checkins FOR SELECT USING (is_teacher());
CREATE POLICY "No direct insert on checkins (use RPC)" ON checkins FOR INSERT WITH CHECK (FALSE);
CREATE POLICY "Admins manage checkins" ON checkins FOR ALL USING (is_admin());

-- POINT TRANSACTIONS
CREATE POLICY "Students view own point transactions" ON point_transactions FOR SELECT USING (student_id = my_student_id());
CREATE POLICY "Teachers view point transactions for their students" ON point_transactions FOR SELECT USING (is_teacher());
CREATE POLICY "No direct insert (use RPC)" ON point_transactions FOR INSERT WITH CHECK (FALSE);
CREATE POLICY "Admins manage point_transactions" ON point_transactions FOR ALL USING (is_admin());

-- ASSIGNMENTS
CREATE POLICY "Teachers view own assignments" ON assignments FOR SELECT USING (teacher_id = auth.uid() OR is_admin());
CREATE POLICY "Teachers manage own assignments" ON assignments FOR ALL USING (teacher_id = auth.uid() OR is_admin());
CREATE POLICY "Students view published assignments assigned to them" ON assignments FOR SELECT USING (
  status = 'PUBLISHED' AND EXISTS (
    SELECT 1 FROM assignment_targets at2
    WHERE at2.assignment_id = assignments.id AND at2.student_id = my_student_id()
  )
);

-- ASSIGNMENT TARGETS
CREATE POLICY "Teachers manage targets for own assignments" ON assignment_targets FOR ALL USING (
  is_teacher() AND EXISTS (SELECT 1 FROM assignments a WHERE a.id = assignment_targets.assignment_id AND a.teacher_id = auth.uid())
  OR is_admin()
);
CREATE POLICY "Students view own targets" ON assignment_targets FOR SELECT USING (student_id = my_student_id());

-- ASSIGNMENT QUESTIONS
CREATE POLICY "Teachers manage questions for own assignments" ON assignment_questions FOR ALL USING (
  is_teacher() AND EXISTS (SELECT 1 FROM assignments a WHERE a.id = assignment_questions.assignment_id AND a.teacher_id = auth.uid())
  OR is_admin()
);
CREATE POLICY "Students view questions for their assignments" ON assignment_questions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM assignments a
    INNER JOIN assignment_targets at2 ON at2.assignment_id = a.id AND at2.student_id = my_student_id()
    WHERE a.id = assignment_questions.assignment_id AND a.status = 'PUBLISHED'
  )
);

-- ASSIGNMENT ATTACHMENTS
CREATE POLICY "Teachers manage own assignment attachments" ON assignment_attachments FOR ALL USING (
  is_teacher() AND EXISTS (SELECT 1 FROM assignments a WHERE a.id = assignment_attachments.assignment_id AND a.teacher_id = auth.uid())
  OR is_admin()
);
CREATE POLICY "Students view assignment attachments" ON assignment_attachments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM assignment_targets at2
    WHERE at2.assignment_id = assignment_attachments.assignment_id AND at2.student_id = my_student_id()
  )
);

-- SUBMISSIONS
CREATE POLICY "Students manage own submissions" ON submissions FOR ALL USING (student_id = my_student_id());
CREATE POLICY "Teachers view submissions for their assignments" ON submissions FOR SELECT USING (
  is_teacher() AND EXISTS (
    SELECT 1 FROM assignments a WHERE a.id = submissions.assignment_id AND a.teacher_id = auth.uid()
  )
);
CREATE POLICY "Teachers update submissions (grading)" ON submissions FOR UPDATE USING (
  is_teacher() AND EXISTS (
    SELECT 1 FROM assignments a WHERE a.id = submissions.assignment_id AND a.teacher_id = auth.uid()
  )
);
CREATE POLICY "Admins manage submissions" ON submissions FOR ALL USING (is_admin());

-- SUBMISSION ANSWERS
CREATE POLICY "Students manage own answers" ON submission_answers FOR ALL USING (
  EXISTS (SELECT 1 FROM submissions s WHERE s.id = submission_answers.submission_id AND s.student_id = my_student_id())
);
CREATE POLICY "Teachers view answers" ON submission_answers FOR SELECT USING (
  is_teacher() AND EXISTS (
    SELECT 1 FROM submissions s
    INNER JOIN assignments a ON a.id = s.assignment_id AND a.teacher_id = auth.uid()
    WHERE s.id = submission_answers.submission_id
  )
);
CREATE POLICY "Teachers update answers (scoring)" ON submission_answers FOR UPDATE USING (
  is_teacher() AND EXISTS (
    SELECT 1 FROM submissions s
    INNER JOIN assignments a ON a.id = s.assignment_id AND a.teacher_id = auth.uid()
    WHERE s.id = submission_answers.submission_id
  )
);

-- SUBMISSION FILES
CREATE POLICY "Students manage own submission files" ON submission_files FOR ALL USING (
  EXISTS (SELECT 1 FROM submissions s WHERE s.id = submission_files.submission_id AND s.student_id = my_student_id())
);
CREATE POLICY "Teachers view submission files" ON submission_files FOR SELECT USING (
  is_teacher() AND EXISTS (
    SELECT 1 FROM submissions s
    INNER JOIN assignments a ON a.id = s.assignment_id AND a.teacher_id = auth.uid()
    WHERE s.id = submission_files.submission_id
  )
);

-- ASSIGNMENT GRADES
CREATE POLICY "Students view own grades" ON assignment_grades FOR SELECT USING (student_id = my_student_id());
CREATE POLICY "Teachers manage grades for own assignments" ON assignment_grades FOR ALL USING (
  is_teacher() AND EXISTS (SELECT 1 FROM assignments a WHERE a.id = assignment_grades.assignment_id AND a.teacher_id = auth.uid())
  OR is_admin()
);

-- GRADE RULES
CREATE POLICY "Teachers manage own grade rules" ON grade_rules FOR ALL USING (created_by = auth.uid() OR is_admin());
CREATE POLICY "Authenticated view grade rules" ON grade_rules FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Authenticated view grade rule items" ON grade_rule_items FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Teachers manage grade rule items" ON grade_rule_items FOR ALL USING (
  is_teacher() AND EXISTS (SELECT 1 FROM grade_rules gr WHERE gr.id = grade_rule_items.grade_rule_id AND gr.created_by = auth.uid())
  OR is_admin()
);

-- GRADE WEIGHTS
CREATE POLICY "Teachers manage own grade weights" ON grade_weights FOR ALL USING (teacher_id = auth.uid() OR is_admin());
CREATE POLICY "Students view grade weights" ON grade_weights FOR SELECT USING (
  EXISTS (SELECT 1 FROM enrollments e WHERE e.student_id = my_student_id() AND e.subject_id = grade_weights.subject_id)
);

-- ASSIGNMENT CONVERSATIONS
CREATE POLICY "Students manage own conversations" ON assignment_conversations FOR ALL USING (student_id = my_student_id());
CREATE POLICY "Teachers view conversations for their assignments" ON assignment_conversations FOR ALL USING (
  is_teacher() AND (teacher_id = auth.uid() OR EXISTS (
    SELECT 1 FROM assignments a WHERE a.id = assignment_conversations.assignment_id AND a.teacher_id = auth.uid()
  ))
);
CREATE POLICY "Admins manage conversations" ON assignment_conversations FOR ALL USING (is_admin());

-- CONVERSATION MESSAGES
CREATE POLICY "Participants view conversation messages" ON conversation_messages FOR SELECT USING (
  sender_user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM assignment_conversations c WHERE c.id = conversation_messages.conversation_id
    AND (c.student_id = my_student_id() OR c.teacher_id = auth.uid()))
  OR is_admin()
);
CREATE POLICY "Participants insert messages" ON conversation_messages FOR INSERT WITH CHECK (
  sender_user_id = auth.uid() AND
  EXISTS (SELECT 1 FROM assignment_conversations c WHERE c.id = conversation_messages.conversation_id
    AND (c.student_id = my_student_id() OR c.teacher_id = auth.uid()))
);
CREATE POLICY "Mark messages as read" ON conversation_messages FOR UPDATE USING (
  EXISTS (SELECT 1 FROM assignment_conversations c WHERE c.id = conversation_messages.conversation_id
    AND (c.student_id = my_student_id() OR c.teacher_id = auth.uid()))
);

-- CONVERSATION ATTACHMENTS
CREATE POLICY "Participants view attachments" ON conversation_attachments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM conversation_messages m
    INNER JOIN assignment_conversations c ON c.id = m.conversation_id
    WHERE m.id = conversation_attachments.message_id
      AND (c.student_id = my_student_id() OR c.teacher_id = auth.uid() OR is_admin())
  )
);
CREATE POLICY "Participants insert attachments" ON conversation_attachments FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversation_messages m
    INNER JOIN assignment_conversations c ON c.id = m.conversation_id
    WHERE m.id = conversation_attachments.message_id
      AND (c.student_id = my_student_id() OR c.teacher_id = auth.uid())
  )
);

-- NOTIFICATIONS
CREATE POLICY "Users view own notifications" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users update own notifications (mark read)" ON notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "System can insert notifications" ON notifications FOR INSERT WITH CHECK (is_admin() OR is_teacher());
CREATE POLICY "Admins manage notifications" ON notifications FOR ALL USING (is_admin());

-- GAMES
CREATE POLICY "Published games visible to all authenticated" ON games FOR SELECT TO authenticated USING (status = 'PUBLISHED' OR is_teacher());
CREATE POLICY "Teachers manage games" ON games FOR ALL USING (created_by = auth.uid() OR is_admin());

-- GAME QUESTIONS
CREATE POLICY "Students view game questions for published games" ON game_questions FOR SELECT USING (
  EXISTS (SELECT 1 FROM games g WHERE g.id = game_questions.game_id AND g.status = 'PUBLISHED')
  OR is_teacher()
);
CREATE POLICY "Teachers manage game questions" ON game_questions FOR ALL USING (
  is_teacher() AND EXISTS (SELECT 1 FROM games g WHERE g.id = game_questions.game_id AND g.created_by = auth.uid())
  OR is_admin()
);

-- GAME ATTEMPTS
CREATE POLICY "Students manage own attempts" ON game_attempts FOR ALL USING (student_id = my_student_id());
CREATE POLICY "Teachers view all attempts" ON game_attempts FOR SELECT USING (is_teacher());

-- GAME REWARDS
CREATE POLICY "Students view own rewards" ON game_rewards FOR SELECT USING (student_id = my_student_id());
CREATE POLICY "Teachers view all rewards" ON game_rewards FOR SELECT USING (is_teacher());
CREATE POLICY "No direct insert on rewards (use RPC)" ON game_rewards FOR INSERT WITH CHECK (FALSE);
CREATE POLICY "Admins manage rewards" ON game_rewards FOR ALL USING (is_admin());

-- AUDIT LOGS
CREATE POLICY "Admins view audit logs" ON audit_logs FOR SELECT USING (is_admin());
CREATE POLICY "System can insert audit logs" ON audit_logs FOR INSERT WITH CHECK (TRUE);

-- ============================================================
-- STORAGE BUCKETS (run after creating buckets in dashboard)
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('assignment-files', 'assignment-files', FALSE);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('submission-files', 'submission-files', FALSE);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('conversation-files', 'conversation-files', FALSE);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', FALSE);

-- Storage RLS (add after creating buckets)
-- CREATE POLICY "Teachers upload assignment files" ON storage.objects FOR INSERT WITH CHECK (
--   bucket_id = 'assignment-files' AND is_teacher()
-- );
-- CREATE POLICY "Authenticated view assignment files" ON storage.objects FOR SELECT USING (
--   bucket_id = 'assignment-files' AND auth.role() = 'authenticated'
-- );
-- CREATE POLICY "Students upload submission files" ON storage.objects FOR INSERT WITH CHECK (
--   bucket_id = 'submission-files' AND auth.role() = 'authenticated'
-- );
-- CREATE POLICY "Participants view submission files" ON storage.objects FOR SELECT USING (
--   bucket_id = 'submission-files' AND auth.role() = 'authenticated'
-- );
-- CREATE POLICY "Participants upload conversation files" ON storage.objects FOR INSERT WITH CHECK (
--   bucket_id = 'conversation-files' AND auth.role() = 'authenticated'
-- );
-- CREATE POLICY "Participants view conversation files" ON storage.objects FOR SELECT USING (
--   bucket_id = 'conversation-files' AND auth.role() = 'authenticated'
-- );
-- CREATE POLICY "Users upload own avatar" ON storage.objects FOR INSERT WITH CHECK (
--   bucket_id = 'avatars' AND auth.uid()::TEXT = (storage.foldername(name))[1]
-- );
-- CREATE POLICY "Anyone view avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

COMMENT ON TABLE students IS 'นักเรียนทั้งหมดในระบบ';
COMMENT ON TABLE point_transactions IS 'บันทึก Point ทุกรายการ — Source of Truth';
COMMENT ON TABLE submissions IS 'การส่งงานของนักเรียน ห้ามลบ ห้ามแก้ไขข้อมูลเก่า';
COMMENT ON TABLE assignment_conversations IS 'การสนทนาระหว่างครูและนักเรียนเกี่ยวกับงาน';
COMMENT ON TABLE audit_logs IS 'บันทึกการกระทำทุกอย่างในระบบ';
