-- Module 1: Job Ingestion POC
-- Database Schema

-- Table: job_raw
-- Stores raw HTML fetches from job posting URLs
CREATE TABLE IF NOT EXISTS job_raw (
  id BIGSERIAL PRIMARY KEY,
  source_url TEXT NOT NULL,
  raw_html TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_type VARCHAR(50) DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_raw_source_url ON job_raw(source_url);
CREATE INDEX idx_job_raw_fetched_at ON job_raw(fetched_at DESC);

-- Table: job_normalized
-- Stores normalized/parsed job data with scoring
CREATE TABLE IF NOT EXISTS job_normalized (
  id BIGSERIAL PRIMARY KEY,
  job_raw_id BIGINT REFERENCES job_raw(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  title VARCHAR(255) NOT NULL,
  company VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  normalized_text TEXT,
  skill_tags TEXT[],
  domain_tags TEXT[],
  visa_confidence VARCHAR(20),
  visa_score_int INTEGER CHECK (visa_score_int >= 0 AND visa_score_int <= 100),
  visa_categories TEXT[],
  visa_explanation TEXT,
  relevance_score INTEGER CHECK (relevance_score >= 0 AND relevance_score <= 100),
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_normalized_job_raw_id ON job_normalized(job_raw_id);
CREATE INDEX idx_job_normalized_relevance_score ON job_normalized(relevance_score DESC);
CREATE INDEX idx_job_normalized_visa_score ON job_normalized(visa_score_int DESC);
CREATE INDEX idx_job_normalized_company ON job_normalized(company);
CREATE INDEX idx_job_normalized_location ON job_normalized(location);

-- Table: company_registry
-- Registry of companies with known visa sponsorship status
CREATE TABLE IF NOT EXISTS company_registry (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  sponsors_visa BOOLEAN DEFAULT FALSE,
  sponsor_confidence VARCHAR(20),
  h1b_history_count INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_company_registry_name ON company_registry(name);
CREATE INDEX idx_company_registry_sponsors_visa ON company_registry(sponsors_visa);

-- Table: ingestion_log
-- Audit log for ingestion operations
CREATE TABLE IF NOT EXISTS ingestion_log (
  id BIGSERIAL PRIMARY KEY,
  source_url TEXT NOT NULL,
  job_raw_id BIGINT REFERENCES job_raw(id) ON DELETE SET NULL,
  job_normalized_id BIGINT REFERENCES job_normalized(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ingestion_log_status ON ingestion_log(status);
CREATE INDEX idx_ingestion_log_created_at ON ingestion_log(created_at DESC);
CREATE INDEX idx_ingestion_log_source_url ON ingestion_log(source_url);

-- Insert sample company registry data
INSERT INTO company_registry (name, sponsors_visa, sponsor_confidence, h1b_history_count, notes)
VALUES 
  ('Google', TRUE, 'high', 5000, 'Major tech company with extensive H1B history'),
  ('Microsoft', TRUE, 'high', 4500, 'Major tech company with extensive H1B history'),
  ('Amazon', TRUE, 'high', 4000, 'Major tech company with extensive H1B history'),
  ('Meta', TRUE, 'high', 2000, 'Major tech company with extensive H1B history'),
  ('Apple', TRUE, 'high', 3000, 'Major tech company with extensive H1B history')
ON CONFLICT (name) DO NOTHING;

-- Comments
COMMENT ON TABLE job_raw IS 'Stores raw HTML content from job posting URLs';
COMMENT ON TABLE job_normalized IS 'Stores normalized and scored job data';
COMMENT ON TABLE company_registry IS 'Registry of companies with visa sponsorship information';
COMMENT ON TABLE ingestion_log IS 'Audit log for job ingestion operations';
