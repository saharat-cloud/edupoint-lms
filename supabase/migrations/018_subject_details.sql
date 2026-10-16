-- Add schedule info to teacher_subjects
ALTER TABLE teacher_subjects
ADD COLUMN IF NOT EXISTS schedule_day VARCHAR(50),
ADD COLUMN IF NOT EXISTS schedule_time VARCHAR(50);

-- Add syllabus to subjects
ALTER TABLE subjects
ADD COLUMN IF NOT EXISTS syllabus TEXT;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
