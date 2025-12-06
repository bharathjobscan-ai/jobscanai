-- Phase 1: Enhanced Schema for Visa Intelligence & Scoring
-- Adds resume management, scoring configuration, and enhanced visa intelligence

-- Table: user_profile
-- Stores user's resume and baseline information for scoring
CREATE TABLE IF NOT EXISTS user_profile (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255),
  email VARCHAR(255),
  years_of_experience INTEGER,
  skills TEXT[],
  preferred_roles TEXT[],
  preferred_locations TEXT[],
  target_countries TEXT[],
  resume_text TEXT,
  resume_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: scoring_config
-- Configurable scoring weights and thresholds
CREATE TABLE IF NOT EXISTS scoring_config (
  id BIGSERIAL PRIMARY KEY,
  config_name VARCHAR(100) NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Component weights (must sum to 100)
  visa_weight DECIMAL(5,2) DEFAULT 50.00,
  relevance_weight DECIMAL(5,2) DEFAULT 25.00,
  realism_weight DECIMAL(5,2) DEFAULT 15.00,
  strategic_weight DECIMAL(5,2) DEFAULT 10.00,
  
  -- Visa sub-weights
  visa_registry_points INTEGER DEFAULT 20,
  visa_recent_activity_points INTEGER DEFAULT 15,
  visa_community_signals_points INTEGER DEFAULT 10,
  visa_jd_keywords_points INTEGER DEFAULT 5,
  
  -- Relevance sub-weights
  relevance_skills_points INTEGER DEFAULT 15,
  relevance_experience_points INTEGER DEFAULT 10,
  
  -- Realism sub-weights
  realism_hiring_trends_points INTEGER DEFAULT 5,
  realism_seniority_match_points INTEGER DEFAULT 5,
  realism_location_points INTEGER DEFAULT 5,
  
  -- Strategic sub-weights
  strategic_salary_points INTEGER DEFAULT 5,
  strategic_industry_points INTEGER DEFAULT 3,
  strategic_growth_points INTEGER DEFAULT 2,
  
  -- Penalty thresholds
  penalty_no_sponsorship INTEGER DEFAULT -30,
  penalty_agency_recruiter INTEGER DEFAULT -10,
  penalty_negative_community INTEGER DEFAULT -15,
  penalty_salary_below_threshold INTEGER DEFAULT -20,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default scoring configuration
INSERT INTO scoring_config (config_name) 
VALUES ('default')
ON CONFLICT (config_name) DO NOTHING;

-- Table: visa_sponsor_registry
-- Consolidated government sponsor data from all countries
CREATE TABLE IF NOT EXISTS visa_sponsor_registry (
  id BIGSERIAL PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  country_code VARCHAR(2) NOT NULL,
  registry_source VARCHAR(100) NOT NULL,
  license_number VARCHAR(100),
  sponsor_type VARCHAR(100),
  valid_from DATE,
  valid_until DATE,
  is_active BOOLEAN DEFAULT TRUE,
  last_verified_at TIMESTAMPTZ,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_visa_sponsor_company ON visa_sponsor_registry(company_name);
CREATE INDEX idx_visa_sponsor_country ON visa_sponsor_registry(country_code);
CREATE INDEX idx_visa_sponsor_active ON visa_sponsor_registry(is_active);

-- Table: visa_salary_thresholds
-- Minimum salary requirements for visa sponsorship by country
CREATE TABLE IF NOT EXISTS visa_salary_thresholds (
  id BIGSERIAL PRIMARY KEY,
  country_code VARCHAR(2) NOT NULL,
  visa_type VARCHAR(100) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  min_salary_annual DECIMAL(12,2) NOT NULL,
  effective_from DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_salary_threshold_country ON visa_salary_thresholds(country_code);

-- Insert salary thresholds for key countries
INSERT INTO visa_salary_thresholds (country_code, visa_type, currency, min_salary_annual, effective_from, notes)
VALUES 
  ('GB', 'Skilled Worker', 'GBP', 26200.00, '2024-04-04', 'UK Skilled Worker minimum (going rate)'),
  ('GB', 'Skilled Worker', 'GBP', 38700.00, '2024-04-04', 'UK Skilled Worker general threshold'),
  ('NL', 'Highly Skilled Migrant', 'EUR', 45000.00, '2024-01-01', 'Netherlands 30% ruling threshold (under 30)'),
  ('NL', 'Highly Skilled Migrant', 'EUR', 57000.00, '2024-01-01', 'Netherlands 30% ruling threshold (over 30)'),
  ('DE', 'EU Blue Card', 'EUR', 45300.00, '2024-01-01', 'Germany Blue Card general threshold'),
  ('DE', 'EU Blue Card', 'EUR', 41041.80, '2024-01-01', 'Germany Blue Card shortage occupations'),
  ('SE', 'Work Permit', 'SEK', 13000.00, '2024-01-01', 'Sweden monthly minimum (pre-tax)'),
  ('AU', 'Temporary Skill Shortage', 'AUD', 70000.00, '2024-01-01', 'Australia TSS visa minimum'),
  ('CA', 'LMIA Work Permit', 'CAD', 27.00, '2024-01-01', 'Canada median hourly wage (varies by province)')
ON CONFLICT DO NOTHING;

-- Table: community_intelligence
-- Stores community signals from Reddit, Glassdoor, forums, etc.
CREATE TABLE IF NOT EXISTS community_intelligence (
  id BIGSERIAL PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  source VARCHAR(50) NOT NULL,
  source_url TEXT,
  signal_type VARCHAR(50),
  sentiment VARCHAR(20),
  content_snippet TEXT,
  mentioned_at TIMESTAMPTZ,
  relevance_score INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_community_company ON community_intelligence(company_name);
CREATE INDEX idx_community_sentiment ON community_intelligence(sentiment);
CREATE INDEX idx_community_mentioned_at ON community_intelligence(mentioned_at DESC);

-- Update job_normalized table to add enhanced scoring fields
ALTER TABLE job_normalized 
ADD COLUMN IF NOT EXISTS visa_registry_match BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS visa_recent_activity INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS visa_community_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS visa_jd_keywords_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS relevance_skills_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS relevance_experience_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS realism_hiring_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS realism_seniority_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS realism_location_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS strategic_salary_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS strategic_industry_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS strategic_growth_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_score INTEGER,
ADD COLUMN IF NOT EXISTS score_breakdown JSONB,
ADD COLUMN IF NOT EXISTS recommendation TEXT,
ADD COLUMN IF NOT EXISTS country_code VARCHAR(2),
ADD COLUMN IF NOT EXISTS salary_raw TEXT,
ADD COLUMN IF NOT EXISTS salary_min DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS salary_max DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS salary_currency VARCHAR(3),
ADD COLUMN IF NOT EXISTS posting_date DATE,
ADD COLUMN IF NOT EXISTS expires_at DATE,
ADD COLUMN IF NOT EXISTS is_remote BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS recruiter_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS recruiter_type VARCHAR(50);

-- Table: bulk_import_jobs
-- Tracks bulk import operations
CREATE TABLE IF NOT EXISTS bulk_import_jobs (
  id BIGSERIAL PRIMARY KEY,
  import_type VARCHAR(50) NOT NULL,
  source_file VARCHAR(255),
  total_urls INTEGER DEFAULT 0,
  processed_urls INTEGER DEFAULT 0,
  successful_urls INTEGER DEFAULT 0,
  failed_urls INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending',
  error_log JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bulk_import_status ON bulk_import_jobs(status);
CREATE INDEX idx_bulk_import_created ON bulk_import_jobs(created_at DESC);

-- Comments
COMMENT ON TABLE user_profile IS 'Stores user resume and preferences for job scoring';
COMMENT ON TABLE scoring_config IS 'Configurable scoring weights and parameters';
COMMENT ON TABLE visa_sponsor_registry IS 'Consolidated government visa sponsor data';
COMMENT ON TABLE visa_salary_thresholds IS 'Minimum salary requirements for visa types';
COMMENT ON TABLE community_intelligence IS 'Community signals about visa sponsorship';
COMMENT ON TABLE bulk_import_jobs IS 'Tracks bulk URL import operations';
