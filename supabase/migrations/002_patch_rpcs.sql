-- ============================================================
-- EduPoint LMS — Patch 002: Fix RPC signatures & add missing functions
-- Run AFTER 001_initial_schema.sql
-- ============================================================

-- ============================================================
-- award_kiosk_point (v2): Simplified Kiosk check-in
-- Called by KioskPage.tsx with: { p_student_id, p_card_number }
-- Awards a daily check-in point without requiring activity_id
-- ============================================================
CREATE OR REPLACE FUNCTION award_kiosk_point(
  p_student_id UUID,
  p_card_number TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student       students%ROWTYPE;
  v_points        INT := 10;          -- default daily check-in points
  v_today         DATE := CURRENT_DATE;
  v_checkin_date  DATE;
  v_streak        INT := 0;
  v_tx_id         UUID;
  v_total_points  BIGINT;
BEGIN
  -- 1. Find student
  SELECT * INTO v_student FROM students WHERE id = p_student_id AND status = 'ACTIVE';
  IF NOT FOUND THEN
    SELECT * INTO v_student FROM students WHERE card_number = p_card_number AND status = 'ACTIVE';
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', FALSE, 'message', 'ไม่พบนักเรียนในระบบ');
    END IF;
  END IF;

  -- 2. Check if already checked in today
  SELECT DATE(created_at AT TIME ZONE 'Asia/Bangkok') INTO v_checkin_date
  FROM point_transactions
  WHERE student_id = v_student.id
    AND source_type = 'KIOSK'
    AND DATE(created_at AT TIME ZONE 'Asia/Bangkok') = v_today
  LIMIT 1;

  IF FOUND THEN
    SELECT COALESCE(SUM(points), 0) INTO v_total_points FROM point_transactions WHERE student_id = v_student.id;
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'already',
      'total_points', v_total_points
    );
  END IF;

  -- 3. Calculate streak (consecutive days)
  SELECT COUNT(*) INTO v_streak
  FROM (
    SELECT DATE(created_at AT TIME ZONE 'Asia/Bangkok') AS d
    FROM point_transactions
    WHERE student_id = v_student.id AND source_type = 'KIOSK'
    GROUP BY 1
    ORDER BY 1 DESC
  ) consecutive
  WHERE d >= v_today - INTERVAL '30 days';

  -- Streak bonus
  IF v_streak >= 6 THEN v_points := 20;
  ELSIF v_streak >= 3 THEN v_points := 15;
  END IF;

  -- 4. Award point
  INSERT INTO point_transactions (
    student_id, points, transaction_type, source_type, note, created_by
  ) VALUES (
    v_student.id, v_points, 'EARN', 'KIOSK',
    'เข้าเรียน ' || TO_CHAR(v_today, 'DD/MM/YYYY'), NULL
  ) RETURNING id INTO v_tx_id;

  -- 5. Notify student
  IF v_student.user_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
    VALUES (
      v_student.user_id, 'POINT_AWARDED',
      'ได้รับ Point เข้าเรียน! ⭐',
      'วันนี้ได้รับ ' || v_points || ' Point จากการเข้าเรียน',
      'checkin', v_tx_id
    );
  END IF;

  -- 6. Total points
  SELECT COALESCE(SUM(points), 0) INTO v_total_points FROM point_transactions WHERE student_id = v_student.id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'points_awarded', v_points,
    'total_points', v_total_points,
    'streak', v_streak + 1
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', FALSE, 'message', SQLERRM);
END;
$$;

-- ============================================================
-- award_game_point (v2): Client-side scoring (trust frontend score)
-- Called by StudentGamePlay.tsx: { p_student_id, p_game_id, p_attempt_id, p_score }
-- ============================================================
CREATE OR REPLACE FUNCTION award_game_point(
  p_student_id  UUID,
  p_game_id     UUID,
  p_attempt_id  UUID,
  p_score       INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game          games%ROWTYPE;
  v_caller_id     UUID;
  v_total_points  BIGINT;
  v_passed        BOOLEAN;
BEGIN
  v_caller_id := auth.uid();

  -- Verify student is the caller (or admin)
  IF NOT EXISTS (SELECT 1 FROM students WHERE id = p_student_id AND user_id = v_caller_id) THEN
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_caller_id AND role = 'SUPER_ADMIN') THEN
      RETURN jsonb_build_object('success', FALSE, 'message', 'UNAUTHORIZED');
    END IF;
  END IF;

  -- Get game
  SELECT * INTO v_game FROM games WHERE id = p_game_id AND status = 'PUBLISHED';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Game not found');
  END IF;

  v_passed := (p_score >= v_game.pass_score);

  -- Mark attempt finished
  UPDATE game_attempts SET
    score = p_score,
    passed = v_passed,
    completed_at = NOW()
  WHERE id = p_attempt_id AND student_id = p_student_id;

  -- Award points only if passed and not already rewarded
  IF v_passed AND v_game.point_reward > 0 THEN
    IF NOT EXISTS (SELECT 1 FROM game_rewards WHERE attempt_id = p_attempt_id) THEN
      INSERT INTO game_rewards (game_id, student_id, attempt_id, points)
      VALUES (v_game.id, p_student_id, p_attempt_id, v_game.point_reward);

      INSERT INTO point_transactions (
        student_id, points, transaction_type, source_type, source_id, game_id, note
      ) VALUES (
        p_student_id, v_game.point_reward, 'EARN', 'GAME', p_attempt_id, v_game.id,
        'เกม: ' || v_game.title
      );

      UPDATE game_attempts SET reward_given = TRUE WHERE id = p_attempt_id;

      -- Notify
      INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
      SELECT user_id, 'GAME_REWARD',
        'ได้รับ Point จากเกม! 🎮',
        'ผ่านเกม ' || v_game.title || ' ได้รับ ' || v_game.point_reward || ' Point',
        'game', v_game.id
      FROM students WHERE id = p_student_id AND user_id IS NOT NULL;
    END IF;
  END IF;

  SELECT COALESCE(SUM(points), 0) INTO v_total_points FROM point_transactions WHERE student_id = p_student_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'passed', v_passed,
    'points_awarded', CASE WHEN v_passed THEN v_game.point_reward ELSE 0 END,
    'total_points', v_total_points
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', TRUE, 'message', 'already_rewarded');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', FALSE, 'message', SQLERRM);
END;
$$;

-- ============================================================
-- MISSING: Add STUDENT_QUESTION and ASSIGNMENT_GRADED to notification_type enum
-- (Only run if types don't already include these)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'notification_type'::regtype
      AND enumlabel = 'STUDENT_QUESTION'
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'STUDENT_QUESTION';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'notification_type'::regtype
      AND enumlabel = 'ASSIGNMENT_GRADED'
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'ASSIGNMENT_GRADED';
  END IF;
END $$;

-- ============================================================
-- MISSING: Add MANUAL and PURCHASE to point_source_type enum
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'point_source_type'::regtype
      AND enumlabel = 'MANUAL'
  ) THEN
    ALTER TYPE point_source_type ADD VALUE 'MANUAL';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'point_source_type'::regtype
      AND enumlabel = 'PURCHASE'
  ) THEN
    ALTER TYPE point_source_type ADD VALUE 'PURCHASE';
  END IF;
END $$;

-- ============================================================
-- MISSING: Add finished_at and points_earned columns
-- ============================================================
ALTER TABLE game_attempts ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS points_earned INT DEFAULT 0;

-- ============================================================
-- MISSING: submission_answers UNIQUE constraint for upsert
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'submission_answers_submission_question_unique'
  ) THEN
    ALTER TABLE submission_answers
      ADD CONSTRAINT submission_answers_submission_question_unique
      UNIQUE (submission_id, question_id);
  END IF;
END $$;

-- ============================================================
-- REALTIME: Enable for key tables
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE assignment_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE submissions;

COMMENT ON FUNCTION award_kiosk_point(UUID, TEXT) IS 'v2: Daily check-in point award for Kiosk (no activity_id required)';
COMMENT ON FUNCTION award_game_point(UUID, UUID, UUID, INT) IS 'v2: Award point after game completion (client-provided score)';
