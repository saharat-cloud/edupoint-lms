-- ============================================================
-- 023: Add golden time + open check-in (no classroom restriction)
-- ============================================================

-- Add golden time columns to existing table
ALTER TABLE checkin_sessions
  ADD COLUMN IF NOT EXISTS golden_minutes INT NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS golden_bonus INT NOT NULL DEFAULT 5;

-- ---- Update RLS: any authenticated student can read open sessions ----
DROP POLICY IF EXISTS "student_read_open_sessions" ON checkin_sessions;

CREATE POLICY "student_read_open_sessions" ON checkin_sessions
  FOR SELECT
  USING (
    status = 'OPEN'
    AND EXISTS (
      SELECT 1 FROM students WHERE students.user_id = auth.uid()
    )
  );

-- ---- Update RLS: any student can insert/read their own record ----
DROP POLICY IF EXISTS "student_read_own_records" ON checkin_records;
DROP POLICY IF EXISTS "student_insert_own_record" ON checkin_records;

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

-- ---- Replace perform_checkin with golden-time logic ----
CREATE OR REPLACE FUNCTION perform_checkin(p_session_id UUID, p_student_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session checkin_sessions%ROWTYPE;
  v_rank INT;
  v_seconds_elapsed FLOAT;
  v_golden_end TIMESTAMPTZ;
  v_in_golden BOOLEAN;
  v_minutes_after_golden FLOAT;
  v_decay INT;
  v_total_pts INT;
  v_tx_id UUID;
  v_record_id UUID;
  v_label TEXT;
BEGIN
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

  IF EXISTS (
    SELECT 1 FROM checkin_records
    WHERE session_id = p_session_id AND student_id = p_student_id
  ) THEN
    RETURN json_build_object('ok', false, 'error', 'เช็คอินไปแล้ว');
  END IF;

  -- Rank
  SELECT COUNT(*) + 1 INTO v_rank FROM checkin_records WHERE session_id = p_session_id;

  -- Golden window
  v_golden_end := v_session.start_time + (v_session.golden_minutes * INTERVAL '1 minute');
  v_in_golden := NOW() <= v_golden_end;

  IF v_in_golden THEN
    -- In golden time: base + golden bonus
    v_total_pts := v_session.base_points + v_session.golden_bonus;
    v_label := '⭐ เวลาทอง';
  ELSE
    -- After golden time: apply decay from end of golden window
    v_minutes_after_golden := EXTRACT(EPOCH FROM (NOW() - v_golden_end)) / 60.0;
    v_decay := FLOOR(v_minutes_after_golden / NULLIF(v_session.decay_interval_minutes, 0))
               * v_session.decay_per_interval;
    v_total_pts := GREATEST(v_session.min_points, v_session.base_points - v_decay);
    v_label := 'เช็คอิน';
  END IF;

  -- Insert point transaction
  INSERT INTO point_transactions(student_id, points, transaction_type, source_type, source_id, note)
  VALUES (
    p_student_id, v_total_pts, 'EARN', 'CHECKIN', p_session_id,
    v_label || ': ' || v_session.title || ' (อันดับที่ ' || v_rank || ')'
  )
  RETURNING id INTO v_tx_id;

  -- Insert checkin record
  INSERT INTO checkin_records(session_id, student_id, rank, points_awarded, point_transaction_id)
  VALUES (p_session_id, p_student_id, v_rank, v_total_pts, v_tx_id)
  RETURNING id INTO v_record_id;

  RETURN json_build_object(
    'ok', true,
    'rank', v_rank,
    'in_golden', v_in_golden,
    'total_points', v_total_pts,
    'record_id', v_record_id
  );
END;
$$;

