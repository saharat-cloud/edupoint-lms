-- ============================================================
-- 022: Check-in System
-- ============================================================

-- Check-in Sessions (created by teacher/admin per classroom)
CREATE TABLE IF NOT EXISTS checkin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_room_id UUID REFERENCES class_rooms(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  title TEXT NOT NULL DEFAULT 'เช็คชื่อ',
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,                        -- NULL = no end limit
  base_points INT NOT NULL DEFAULT 10,
  bonus_1st INT NOT NULL DEFAULT 5,
  bonus_2nd INT NOT NULL DEFAULT 3,
  bonus_3rd INT NOT NULL DEFAULT 1,
  decay_per_interval INT NOT NULL DEFAULT 1,   -- points deducted per interval
  decay_interval_minutes INT NOT NULL DEFAULT 5, -- interval in minutes
  min_points INT NOT NULL DEFAULT 1,           -- floor for point decay
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Check-in Records (one per student per session)
CREATE TABLE IF NOT EXISTS checkin_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES checkin_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rank INT,
  points_awarded INT NOT NULL DEFAULT 0,
  point_transaction_id UUID,
  UNIQUE(session_id, student_id)
);

-- ---- RLS ----

ALTER TABLE checkin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkin_records ENABLE ROW LEVEL SECURITY;

-- Teachers / Admin: full access to sessions
CREATE POLICY "admin_teacher_manage_sessions" ON checkin_sessions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('SUPER_ADMIN','TEACHER')
    )
  );

-- Students: read open sessions for their classroom
CREATE POLICY "student_read_open_sessions" ON checkin_sessions
  FOR SELECT
  USING (
    status = 'OPEN'
    AND EXISTS (
      SELECT 1 FROM students
      WHERE students.user_id = auth.uid()
        AND students.class_room_id = checkin_sessions.class_room_id
    )
  );

-- Admin/Teacher: full access to records
CREATE POLICY "admin_teacher_manage_records" ON checkin_records
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('SUPER_ADMIN','TEACHER')
    )
  );

-- Students: read their own records; insert their own record
CREATE POLICY "student_read_own_records" ON checkin_records
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM students
      WHERE students.user_id = auth.uid()
        AND students.id = checkin_records.student_id
    )
  );

CREATE POLICY "student_insert_own_record" ON checkin_records
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM students
      WHERE students.user_id = auth.uid()
        AND students.id = checkin_records.student_id
    )
  );

-- ---- RPC: perform_checkin ----
-- Called by student; calculates rank, points, and inserts point_transaction atomically.

CREATE OR REPLACE FUNCTION perform_checkin(p_session_id UUID, p_student_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session checkin_sessions%ROWTYPE;
  v_rank INT;
  v_minutes_late FLOAT;
  v_decay INT;
  v_base_pts INT;
  v_bonus INT;
  v_total_pts INT;
  v_tx_id UUID;
  v_record_id UUID;
BEGIN
  -- Lock and fetch session
  SELECT * INTO v_session FROM checkin_sessions WHERE id = p_session_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'ไม่พบ session');
  END IF;

  IF v_session.status <> 'OPEN' THEN
    RETURN json_build_object('ok', false, 'error', 'session นี้ปิดแล้ว');
  END IF;

  IF v_session.end_time IS NOT NULL AND NOW() > v_session.end_time THEN
    RETURN json_build_object('ok', false, 'error', 'หมดเวลาเช็คอินแล้ว');
  END IF;

  -- Already checked in?
  IF EXISTS (SELECT 1 FROM checkin_records WHERE session_id = p_session_id AND student_id = p_student_id) THEN
    RETURN json_build_object('ok', false, 'error', 'เช็คอินไปแล้ว');
  END IF;

  -- Rank = current count + 1
  SELECT COUNT(*) + 1 INTO v_rank FROM checkin_records WHERE session_id = p_session_id;

  -- Decay calculation
  v_minutes_late := GREATEST(0, EXTRACT(EPOCH FROM (NOW() - v_session.start_time)) / 60.0);
  v_decay := FLOOR(v_minutes_late / NULLIF(v_session.decay_interval_minutes, 0)) * v_session.decay_per_interval;
  v_base_pts := GREATEST(v_session.min_points, v_session.base_points - v_decay);

  -- Bonus for top 3
  v_bonus := CASE
    WHEN v_rank = 1 THEN v_session.bonus_1st
    WHEN v_rank = 2 THEN v_session.bonus_2nd
    WHEN v_rank = 3 THEN v_session.bonus_3rd
    ELSE 0
  END;

  v_total_pts := v_base_pts + v_bonus;

  -- Insert point transaction
  INSERT INTO point_transactions(student_id, points, transaction_type, source_type, source_id, note)
  VALUES (p_student_id, v_total_pts, 'EARN', 'CHECKIN', p_session_id,
          'เช็คอิน: ' || v_session.title || ' (อันดับที่ ' || v_rank || ')')
  RETURNING id INTO v_tx_id;

  -- Insert checkin record
  INSERT INTO checkin_records(session_id, student_id, rank, points_awarded, point_transaction_id)
  VALUES (p_session_id, p_student_id, v_rank, v_total_pts, v_tx_id)
  RETURNING id INTO v_record_id;

  RETURN json_build_object(
    'ok', true,
    'rank', v_rank,
    'base_points', v_base_pts,
    'bonus', v_bonus,
    'total_points', v_total_pts,
    'record_id', v_record_id
  );
END;
$$;
