-- Migration 005: Add tracking columns for visa registry imports
-- Purpose: Track when companies are deactivated and link to import batches

-- Add tracking columns to visa_sponsor_registry
ALTER TABLE visa_sponsor_registry
ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

ALTER TABLE visa_sponsor_registry
ADD COLUMN IF NOT EXISTS fetch_id VARCHAR(100);

ALTER TABLE visa_sponsor_registry
ADD COLUMN IF NOT EXISTS fetch_source VARCHAR(50);

ALTER TABLE visa_sponsor_registry
ADD COLUMN IF NOT EXISTS fetch_date DATE;

-- Add status enum-like column for clarity
ALTER TABLE visa_sponsor_registry
ADD COLUMN IF NOT EXISTS sponsorship_status VARCHAR(20) DEFAULT 'active'
CHECK (sponsorship_status IN ('active', 'inactive', 'pending', 'unknown'));

-- Create index for efficient queries on status
CREATE INDEX IF NOT EXISTS idx_visa_sponsor_status ON visa_sponsor_registry(sponsorship_status);
CREATE INDEX IF NOT EXISTS idx_visa_sponsor_deactivated ON visa_sponsor_registry(deactivated_at);
CREATE INDEX IF NOT EXISTS idx_visa_sponsor_fetch_id ON visa_sponsor_registry(fetch_id);

-- Create table to track import batches (for audit trail)
CREATE TABLE IF NOT EXISTS visa_registry_imports (
  id BIGSERIAL PRIMARY KEY,
  fetch_id VARCHAR(100) NOT NULL UNIQUE,
  country_code VARCHAR(2) NOT NULL,
  source_url TEXT NOT NULL,
  source_type VARCHAR(50) NOT NULL,
  records_processed INTEGER DEFAULT 0,
  records_inserted INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_deactivated INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  raw_summary JSONB
);

CREATE INDEX IF NOT EXISTS idx_visa_imports_country ON visa_registry_imports(country_code);
CREATE INDEX IF NOT EXISTS idx_visa_imports_fetch_id ON visa_registry_imports(fetch_id);
CREATE INDEX IF NOT EXISTS idx_visa_imports_completed ON visa_registry_imports(completed_at DESC);

-- Comments
COMMENT ON COLUMN visa_sponsor_registry.deactivated_at IS 'Timestamp when company stopped sponsoring (for audit)';
COMMENT ON COLUMN visa_sponsor_registry.fetch_id IS 'Unique ID linking to import batch';
COMMENT ON COLUMN visa_sponsor_registry.fetch_source IS 'Source URL or file of the fetch';
COMMENT ON COLUMN visa_sponsor_registry.fetch_date IS 'Date of the source data';
COMMENT ON COLUMN visa_sponsor_registry.sponsorship_status IS 'Current sponsorship status: active, inactive, pending';
COMMENT ON TABLE visa_registry_imports IS 'Audit trail for each import batch';
