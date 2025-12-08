-- Migration: Enhanced Profile Schema & Multi-Score System
-- Purpose: Add skill categorization, salary expectations, role flexibility, and enhanced scoring

-- ============================================
-- 1. UPDATE user_profile TABLE
-- ============================================

-- Add new columns for enhanced profile
ALTER TABLE user_profile
ADD COLUMN IF NOT EXISTS skills_must_have_domain TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS skills_must_have_core_pm TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS skills_good_to_have TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS skills_okay_to_have TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS role_flexibility JSONB DEFAULT '{"preferred": [], "acceptable": []}',
ADD COLUMN IF NOT EXISTS salary_expectation JSONB DEFAULT '{"min": null, "max": null, "currency": "GBP"}',
ADD COLUMN IF NOT EXISTS industries TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS needs_visa_sponsorship BOOLEAN DEFAULT true;

-- Keep legacy skills column for backward compatibility
-- We'll migrate it later if needed

-- ============================================
-- 2. CREATE profile_versions TABLE (Layer 3 prep)
-- ============================================

CREATE TABLE IF NOT EXISTS profile_versions (
  id SERIAL PRIMARY KEY,
  user_profile_id INTEGER REFERENCES user_profile(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  changed_fields JSONB NOT NULL, -- {"skills_must_have_domain": {"old": [...], "new": [...]}}
  changed_by TEXT DEFAULT 'user',
  change_reason TEXT,
  snapshot JSONB NOT NULL, -- Full profile snapshot at this version
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_versions_user ON profile_versions(user_profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_versions_created ON profile_versions(created_at DESC);

-- ============================================
-- 3. UPDATE job_normalized TABLE - Add Score Fields
-- ============================================

ALTER TABLE job_normalized
ADD COLUMN IF NOT EXISTS visa_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS resume_match_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS job_relevance_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS overall_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS score_breakdown JSONB DEFAULT '{}';

-- Add indexes for filtering by new scores
CREATE INDEX IF NOT EXISTS idx_job_normalized_visa_score ON job_normalized(visa_score DESC);
CREATE INDEX IF NOT EXISTS idx_job_normalized_resume_score ON job_normalized(resume_match_score DESC);
CREATE INDEX IF NOT EXISTS idx_job_normalized_relevance_score ON job_normalized(job_relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_job_normalized_overall_score ON job_normalized(overall_score DESC);

-- ============================================
-- 4. UPDATE scoring_config TABLE
-- ============================================

-- Add new scoring weights for multi-score system
ALTER TABLE scoring_config
ADD COLUMN IF NOT EXISTS visa_score_weight DECIMAL(3,2) DEFAULT 0.40,
ADD COLUMN IF NOT EXISTS resume_score_weight DECIMAL(3,2) DEFAULT 0.35,
ADD COLUMN IF NOT EXISTS relevance_score_weight DECIMAL(3,2) DEFAULT 0.25,
ADD COLUMN IF NOT EXISTS domain_skills_weight DECIMAL(3,2) DEFAULT 0.50,
ADD COLUMN IF NOT EXISTS core_pm_skills_weight DECIMAL(3,2) DEFAULT 0.30,
ADD COLUMN IF NOT EXISTS tools_skills_weight DECIMAL(3,2) DEFAULT 0.15,
ADD COLUMN IF NOT EXISTS tech_skills_weight DECIMAL(3,2) DEFAULT 0.05;

-- Update default config with new weights
UPDATE scoring_config
SET 
  visa_score_weight = 0.40,
  resume_score_weight = 0.35,
  relevance_score_weight = 0.25,
  domain_skills_weight = 0.50,
  core_pm_skills_weight = 0.30,
  tools_skills_weight = 0.15,
  tech_skills_weight = 0.05
WHERE config_name = 'default';

-- ============================================
-- 5. CREATE HELPER FUNCTIONS
-- ============================================

-- Function to calculate skill match percentage
CREATE OR REPLACE FUNCTION calculate_skill_match(
  user_skills TEXT[],
  job_skills TEXT[]
) RETURNS DECIMAL AS $$
DECLARE
  matched_count INTEGER;
  total_user_skills INTEGER;
BEGIN
  total_user_skills := array_length(user_skills, 1);
  IF total_user_skills IS NULL OR total_user_skills = 0 THEN
    RETURN 0;
  END IF;
  
  SELECT COUNT(*)
  INTO matched_count
  FROM unnest(user_skills) AS us
  WHERE us = ANY(job_skills);
  
  RETURN (matched_count::DECIMAL / total_user_skills::DECIMAL) * 100;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get salary in GBP equivalent (simplified)
CREATE OR REPLACE FUNCTION normalize_salary_to_gbp(
  amount DECIMAL,
  currency TEXT
) RETURNS DECIMAL AS $$
BEGIN
  CASE currency
    WHEN 'GBP' THEN RETURN amount;
    WHEN 'USD' THEN RETURN amount * 0.79;  -- Approx conversion
    WHEN 'EUR' THEN RETURN amount * 0.85;
    WHEN 'AUD' THEN RETURN amount * 0.52;
    WHEN 'CAD' THEN RETURN amount * 0.58;
    WHEN 'SEK' THEN RETURN amount * 0.074;
    WHEN 'AED' THEN RETURN amount * 0.21;
    ELSE RETURN amount;  -- Default to same value
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

COMMENT ON TABLE profile_versions IS 'Tracks all changes to user profiles for audit trail and Layer 3 version control';
COMMENT ON COLUMN job_normalized.visa_score IS 'Visa sponsorship likelihood score (0-100)';
COMMENT ON COLUMN job_normalized.resume_match_score IS 'Resume skills match score (0-100)';
COMMENT ON COLUMN job_normalized.job_relevance_score IS 'Job relevance score including location, salary, role (0-100)';
COMMENT ON COLUMN job_normalized.overall_score IS 'Weighted combination of all scores (0-100)';
COMMENT ON COLUMN job_normalized.score_breakdown IS 'Detailed JSON breakdown of score components';
