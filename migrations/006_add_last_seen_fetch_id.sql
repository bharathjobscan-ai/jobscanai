-- Migration 006: Add last_seen_fetch_id column for efficient deactivation
-- Replaces inefficient NOT IN queries with simple comparison

ALTER TABLE visa_sponsor_registry
ADD COLUMN IF NOT EXISTS last_seen_fetch_id VARCHAR(100);

-- Create index for faster lookups during deactivation
CREATE INDEX IF NOT EXISTS idx_visa_sponsor_last_seen 
ON visa_sponsor_registry(country_code, is_active, last_seen_fetch_id);

-- Comments
COMMENT ON COLUMN visa_sponsor_registry.last_seen_fetch_id IS 'Fetch ID of the last batch where this company was seen (for efficient deactivation)';