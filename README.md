# JobScan AI - Module 1 Ingestion POC

Job ingestion and scoring system with visa sponsorship intelligence.

## Overview

This POC demonstrates the core ingestion pipeline:
1. Fetch raw HTML from job posting URLs
2. Normalize and parse job data using heuristics
3. Score visa sponsorship likelihood
4. Compute overall relevance scores
5. Store results in Supabase

## Setup

### Prerequisites
- Node.js 16+
- Supabase account and project

### Environment Variables

Create a `.env` file in the project root:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
```

### Install Dependencies

```bash
npm install
```

### Database Setup

Run the migration script in your Supabase SQL editor:

```bash
migrations/001_module1.sql
```

This creates the following tables:
- `job_raw` - Raw HTML storage
- `job_normalized` - Normalized job data with scores
- `company_registry` - Known visa sponsors
- `ingestion_log` - Audit trail

## API Endpoints

### POST /api/ingest/manual

Ingest a job posting from a URL.

**Request:**
```json
{
  "url": "https://www.linkedin.com/jobs/view/123456",
  "resume_baseline": {
    "skills": ["JavaScript", "Python", "React"],
    "keywords": ["software engineer", "full stack"],
    "domains": ["Backend", "Cloud"],
    "preferred_companies": ["Google", "Microsoft"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "job_normalized_id": 123,
  "title": "Senior Software Engineer",
  "company": "Google",
  "visa_score": 90,
  "relevance_score": 85
}
```

### GET /api/jobs

List normalized jobs with optional filters.

**Query Parameters:**
- `country` - Filter by location (e.g., "USA", "Canada")
- `min_score` - Minimum relevance score (0-100)

**Example:**
```bash
GET /api/jobs?country=USA&min_score=70
```

**Response:**
```json
{
  "success": true,
  "count": 10,
  "jobs": [
    {
      "id": 123,
      "title": "Senior Software Engineer",
      "company": "Google",
      "location": "Mountain View, CA",
      "visa_score_int": 90,
      "relevance_score": 85,
      "skill_tags": ["JavaScript", "Python", "React"],
      "domain_tags": ["Backend", "Cloud"]
    }
  ]
}
```

## Scoring System

### Visa Score (0-100)
- **High (90-100)**: Explicit sponsorship mentioned
- **Medium (50-89)**: Visa keywords or known sponsor
- **Low (0-49)**: No information or negative signals

### Relevance Score (0-100)
Weighted combination of:
- Visa Score: 40%
- Resume Relevance: 25%
- Skills Match: 20%
- Company Preference: 10%
- Domain Match: 5%

**Floor Multiplier:**
- Visa score < 30: 50% penalty
- Visa score < 50: 25% penalty

## Testing Locally

### Using Vercel CLI

```bash
vercel dev
```

### Test with Sample Data

```bash
curl -X POST http://localhost:3000/api/ingest/manual \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/job",
    "resume_baseline": {
      "skills": ["JavaScript", "React"],
      "keywords": ["software engineer"]
    }
  }'
```

### List Jobs

```bash
curl http://localhost:3000/api/jobs?min_score=50
```

## Project Structure

```
jobscanai/
├── api/
│   ├── ingest/
│   │   └── manual.js          # POST handler for job ingestion
│   └── jobs/
│       └── index.js           # GET handler for job listing
├── lib/
│   ├── normalizers/
│   │   └── basic.js           # HTML normalization logic
│   ├── visa_intel/
│   │   └── basic.js           # Visa scoring logic
│   └── scoring/
│       └── simple.js          # Relevance scoring logic
├── migrations/
│   └── 001_module1.sql        # Database schema
├── tests/
│   └── fixtures/
│       └── sample_linkedin.html  # Sample HTML for testing
├── package.json
└── README.md
```

## Next Steps

1. **Enhanced Parsing**: Add platform-specific parsers (LinkedIn, Indeed, etc.)
2. **ML Models**: Replace heuristics with trained models
3. **Batch Processing**: Add scheduled crawling
4. **User Profiles**: Store resume baselines per user
5. **Real-time Updates**: WebSocket notifications for new matches

## License

ISC
