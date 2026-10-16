-- ============================================================
-- EduPoint LMS — Add game_type to games
-- ============================================================

ALTER TABLE games 
ADD COLUMN IF NOT EXISTS game_type TEXT NOT NULL DEFAULT 'QUIZ' 
CHECK (game_type IN ('QUIZ', 'SHOOTER', 'RUNNER', 'MATCHING'));

-- Update one of the seed games to be a SHOOTER for demonstration
UPDATE games SET game_type = 'SHOOTER' WHERE title = 'ความรู้รอบตัว IT';
