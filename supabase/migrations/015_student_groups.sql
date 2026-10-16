-- ============================================================
-- EduPoint LMS — Patch 015: Student Groups
-- ============================================================

CREATE TABLE IF NOT EXISTS student_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES class_rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS student_group_members (
  group_id UUID REFERENCES student_groups(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  is_leader BOOLEAN DEFAULT false,
  PRIMARY KEY (group_id, student_id)
);

-- RLS
ALTER TABLE student_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin access student_groups" ON student_groups USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('SUPER_ADMIN', 'TEACHER'))
);

CREATE POLICY "Admin access student_group_members" ON student_group_members USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('SUPER_ADMIN', 'TEACHER'))
);

-- Notify PostgREST
NOTIFY pgrst, 'reload schema';
