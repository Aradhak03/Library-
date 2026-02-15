-- Migration: Add exclusion constraint to prevent overlapping payment periods
-- Safe to run multiple times - will skip if constraint already exists

-- Step 1: Enable the btree_gist extension (required for exclusion constraints)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Step 2: Add the exclusion constraint (only if it doesn't exist)
-- This prevents two payments for the same booking from having overlapping date ranges
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'no_overlapping_periods'
    ) THEN
        ALTER TABLE payments
        ADD CONSTRAINT no_overlapping_periods
        EXCLUDE USING gist (
            booking_id WITH =,
            daterange(period_start, period_end, '[)') WITH &&
        );
        RAISE NOTICE 'Constraint no_overlapping_periods added successfully';
    ELSE
        RAISE NOTICE 'Constraint no_overlapping_periods already exists, skipping';
    END IF;
END $$;

-- Verification (optional - run to check if constraint exists):
-- SELECT conname, contype, pg_get_constraintdef(oid) 
-- FROM pg_constraint 
-- WHERE conname = 'no_overlapping_periods';

