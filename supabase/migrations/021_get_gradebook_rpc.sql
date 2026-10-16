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
    -- Simply fetch students in the selected classroom, without requiring manual enrollments table entry
    SELECT s.id, s.student_code, s.first_name, s.last_name, s.nickname
    FROM students s
    WHERE s.class_room_id = p_class_room_id
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
  LEFT JOIN grade_rules gr ON gr.subject_id = p_subject_id AND gr.semester_id = p_semester_id
  LEFT JOIN grade_rule_items gri ON gri.rule_id = gr.id
    AND sg.avg_percentage >= gri.min_percentage
    AND sg.avg_percentage <= gri.max_percentage
  ORDER BY sg.student_code ASC;
END;
$$;

NOTIFY pgrst, 'reload schema';
