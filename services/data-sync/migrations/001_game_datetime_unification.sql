-- Migration: NBA Game Datetime Unification
-- Description: Merge game_date + game_time into single game_datetime (TIMESTAMPTZ)
--              Add is_time_tbd flag to track games with unknown start times
-- Version: 001
-- Date: 2026-01-25

-- ============================================================================
-- PHASE 1: Add new columns
-- ============================================================================

-- Add game_datetime column (TIMESTAMPTZ for proper timezone handling)
ALTER TABLE public.games
ADD COLUMN IF NOT EXISTS game_datetime TIMESTAMPTZ;

-- Add is_time_tbd flag (true when game time is not yet announced)
ALTER TABLE public.games
ADD COLUMN IF NOT EXISTS is_time_tbd BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- PHASE 2: Migrate existing data
-- ============================================================================

-- Combine game_date + game_time into game_datetime
-- Treat stored times as UTC (which is how they were being stored)
UPDATE public.games
SET
    game_datetime = (
        CASE
            WHEN game_time IS NOT NULL THEN
                (game_date::text || 'T' || game_time::text || '+00:00')::timestamptz
            ELSE
                (game_date::text || 'T00:00:00+00:00')::timestamptz
        END
    ),
    is_time_tbd = (game_time IS NULL OR game_time = '00:00:00'::time);

-- ============================================================================
-- PHASE 3: Set NOT NULL constraint
-- ============================================================================

-- Ensure game_datetime is never null
ALTER TABLE public.games
ALTER COLUMN game_datetime SET NOT NULL;

-- ============================================================================
-- PHASE 4: Create indexes for performance
-- ============================================================================

-- Index on game_datetime for time-based queries
CREATE INDEX IF NOT EXISTS idx_games_datetime
ON public.games (game_datetime);

-- Composite index for season + datetime queries (common pattern)
CREATE INDEX IF NOT EXISTS idx_games_season_datetime
ON public.games (season, game_datetime);

-- ============================================================================
-- PHASE 5: Create helper view for Tokyo timezone
-- ============================================================================

-- This view provides pre-computed Tokyo date/time for frontend queries
-- Usage: SELECT * FROM games_tokyo WHERE game_date_tokyo = '2026-01-25'
CREATE OR REPLACE VIEW public.games_tokyo AS
SELECT
    *,
    (game_datetime AT TIME ZONE 'Asia/Tokyo')::date AS game_date_tokyo,
    (game_datetime AT TIME ZONE 'Asia/Tokyo')::time AS game_time_tokyo
FROM public.games;

-- ============================================================================
-- PHASE 6: Drop old columns (AFTER verifying all services work)
-- ============================================================================
-- IMPORTANT: Only run this AFTER all services have been updated and tested!
-- Uncomment the lines below when ready:

-- DROP INDEX IF EXISTS games_game_date_idx;
-- ALTER TABLE public.games DROP COLUMN IF EXISTS game_date;
-- ALTER TABLE public.games DROP COLUMN IF EXISTS game_time;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify migration success:
-- SELECT id, game_datetime, is_time_tbd, game_date, game_time FROM games LIMIT 10;

-- Check Tokyo view works correctly:
-- SELECT id, game_datetime, game_date_tokyo, game_time_tokyo FROM games_tokyo LIMIT 5;

-- Count games by is_time_tbd:
-- SELECT is_time_tbd, COUNT(*) FROM games GROUP BY is_time_tbd;

-- ============================================================================
-- ROLLBACK SCRIPT (if needed)
-- ============================================================================
-- To rollback this migration:
--
-- ALTER TABLE public.games ADD COLUMN IF NOT EXISTS game_date DATE;
-- ALTER TABLE public.games ADD COLUMN IF NOT EXISTS game_time TIME;
-- UPDATE public.games SET
--   game_date = (game_datetime AT TIME ZONE 'UTC')::date,
--   game_time = (game_datetime AT TIME ZONE 'UTC')::time;
-- ALTER TABLE public.games DROP COLUMN IF EXISTS game_datetime;
-- ALTER TABLE public.games DROP COLUMN IF EXISTS is_time_tbd;
-- DROP VIEW IF EXISTS public.games_tokyo;
-- DROP INDEX IF EXISTS idx_games_datetime;
-- DROP INDEX IF EXISTS idx_games_season_datetime;
