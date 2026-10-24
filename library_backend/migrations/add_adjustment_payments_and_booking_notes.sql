-- Migration: Add adjustment payment support and booking notes
-- Safe to run multiple times - uses IF NOT EXISTS / IF EXISTS guards throughout
-- Run AFTER the original add_payment_constraint.sql migration

-- ============================================================
-- 1. Add is_adjustment column to payments (if not already present)
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'payments' AND column_name = 'is_adjustment'
    ) THEN
        ALTER TABLE payments ADD COLUMN is_adjustment BOOLEAN NOT NULL DEFAULT false;
        RAISE NOTICE 'Column is_adjustment added to payments';
    ELSE
        RAISE NOTICE 'Column is_adjustment already exists, skipping';
    END IF;
END $$;

-- ============================================================
-- 2. Add note column to payments (if not already present)
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'payments' AND column_name = 'note'
    ) THEN
        ALTER TABLE payments ADD COLUMN note TEXT;
        RAISE NOTICE 'Column note added to payments';
    ELSE
        RAISE NOTICE 'Column note already exists, skipping';
    END IF;
END $$;

-- ============================================================
-- 3. Make period_start and period_end nullable (for adjustment payments)
-- ============================================================
ALTER TABLE payments ALTER COLUMN period_start DROP NOT NULL;
ALTER TABLE payments ALTER COLUMN period_end DROP NOT NULL;

-- ============================================================
-- 4. Enable btree_gist extension & update the exclusion constraint
--    Old: applies to ALL payments
--    New: applies only WHERE is_adjustment = false (regular payments only)
-- ============================================================
-- Enable btree_gist (required for integer '=' operator in GiST index)
CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
    -- Drop old constraint if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'no_overlapping_periods'
    ) THEN
        ALTER TABLE payments DROP CONSTRAINT no_overlapping_periods;
        RAISE NOTICE 'Dropped old no_overlapping_periods constraint';
    END IF;

    -- Re-create with WHERE clause so adjustments bypass it
    ALTER TABLE payments
    ADD CONSTRAINT no_overlapping_periods
    EXCLUDE USING gist (
        booking_id WITH =,
        daterange(period_start, period_end, '[)') WITH &&
    )
    WHERE (is_adjustment = false);

    RAISE NOTICE 'Constraint no_overlapping_periods recreated with WHERE (is_adjustment = false)';
END $$;

-- ============================================================
-- 5. Add notes column to bookings (admin scratch pad)
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'bookings' AND column_name = 'notes'
    ) THEN
        ALTER TABLE bookings ADD COLUMN notes TEXT;
        RAISE NOTICE 'Column notes added to bookings';
    ELSE
        RAISE NOTICE 'Column notes already exists, skipping';
    END IF;
END $$;

-- ============================================================
-- Verification queries (optional - uncomment to check)
-- ============================================================
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'payments'
-- ORDER BY ordinal_position;
--
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conname = 'no_overlapping_periods';
