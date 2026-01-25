# Phase 1: Foundation - COMPLETED ✅

## Overview
Phase 1 establishes the core infrastructure for JobScanAI with enhanced visa-centric job scoring.

## 🎯 What Was Built

### 1. Database Schema Enhancements
**File:** `migrations/002_phase1_enhancements.sql`

- **user_profile**: Resume and preference storage
- **scoring_config**: Configurable scoring weights (fully customizable)
- **visa_sponsor_registry**: Government sponsor data (UK, NL, DE, SE, AU, CA, UAE)
- **visa_salary_thresholds**: Minimum salary requirements by country
- **community_intelligence**: Reddit/Glassdoor/community signals
- **bulk_import_jobs**: Tracks bulk URL import operations
- Enhanced `job_normalized` table with detailed scoring fields

### 2. Bulk Import System
**File:** `api/ingest/bulk.js`

- Accepts JSON array of job URLs
- Batch processing (5 URLs at a time)
- Duplicate detection
- Background job processing
- Progress tracking
- Error logging

**Usage:**
```bash
curl -X POST https://your-domain.vercel.app/api/ingest/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      "https://example.com/job1",
      "https://example.com/job2"
    ]
  }'
```

### 3. Enhanced HTML Normalizer
**File:** `lib/normalizers/enhanced.js`

**Extracts:**
- Job title (meta tags, h1, title)
- Company name (meta tags, patterns)
- Location with country code detection
- Salary (GBP, EUR, USD, AUD, CAD, SEK)
- Skills (50+ tech skills)
- Domains (FinTech, SaaS, AI/ML, etc.)
- Remote work detection
- Recruiter type classification
- Posting date

### 4. Enhanced Visa Intelligence Engine
**File:** `lib/visa_intel/enhanced.js`

**Multi-Tier Analysis:**

**Tier 1 - Official Registry (20 pts)**
- Government sponsor registry matching
- License verification
- Country-specific sponsor lookup

**Tier 2 - Community Intelligence (10 pts)**
- Reddit mentions
- Glassdoor reviews
- Forum discussions

**Tier 3 - Job Description Signals (5 pts)**
- Visa sponsorship keywords
- Explicit mentions
- Negative signal detection

**Additional Factors:**
- Recent sponsorship activity (up to 15 pts)
- Salary threshold validation (penalties if below)
- Red flag detection ("no sponsorship" keywords)

**Registry Sources:**
| Country | Source | URL |
|---------|--------|-----|
| UK | Home Office | skilled-worker-sponsor-list.csv |
| NL | IND | Recognised Sponsors List |
| AU | DHA | TSS Occupations List |
| CA | ESDC | LMIA Public Registry |

### 5. Enhanced Scoring Engine
**Files:** `lib/scoring/enhanced.js` (4-component) and `lib/scoring/multi-score.js` (3-component)

#### **Multi-Score System (Active) - `lib/scoring/multi-score.js`**

**3-Component Weighted System:**

| Component | Weight | Max Points |
|-----------|--------|------------|
| **Visa Score** | 40% | 100 |
| **Resume Match Score** | 35% | 100 |
| **Job Relevance Score** | 25% | 100 |

**Overall Score = (Visa × 0.40) + (Resume × 0.35) + (Relevance × 0.25)**

---

**Visa Score Breakdown (Actual from `lib/scoring/multi-score.js`):**
| Factor | Points | Description |
|--------|--------|-------------|
| Registry Match | 40 pts | Official government sponsor (Tier 1) |
| Recent Activity | 20 pts | Sponsorship activity in last 6 months |
| Community Signals | 20 pts | Reddit/Glassdoor positive mentions |
| JD Keywords | 10 pts | Explicit sponsorship keywords |
| Salary Threshold | 10 pts | Meets minimum visa salary requirement |

**Total:** 100 points possible before penalties

**Penalties:**
- "No sponsorship" mentioned: -30 pts
- Agency recruiter: -10 pts
- Negative community signals: -15 pts

---

**Resume Match Score Breakdown (0-100):**
| Skill Category | Max Points | Weight |
|----------------|------------|--------|
| Domain Skills (must-have) | 50 pts | 50% |
| Core PM Skills | 30 pts | 30% |
| PM Tools | 15 pts | 15% |
| Technical/Nice-to-have | 5 pts | 5% |

---

**Job Relevance Score Breakdown (0-100):**
| Factor | Points |
|--------|--------|
| Location Match | 25 pts |
| Salary Match | 25 pts |
| Role/Seniority Match | 25 pts |
| Experience Level | 15 pts |
| Industry/Company | 10 pts |

---

#### **Enhanced 4-Component System (Legacy) - `lib/scoring/enhanced.js`**

| Component | Weight |
|-----------|--------|
| Visa Sponsorship | 50% |
| Job Relevance | 25% |
| Application Realism | 15% |
| Strategic Value | 10% |

**Penalties:**
- "No sponsorship": -30 pts
- Agency recruiter: -10 pts
- Negative community signals: -15 pts
- Below salary threshold: -20 pts

**Output Example:**
```
⭐⭐⭐⭐⭐ APPLY NOW - Visa Likelihood: HIGH
Total Score: 92/100

Breakdown:
├─ Visa: 48/50 (weighted: 24)
│  ├─ Registry: ✅ 20
│  ├─ Recent Activity: ✅ 15
│  ├─ Community: ✅ 8
│  └─ JD Keywords: ✅ 5
├─ Relevance: 22/25 (weighted: 22)
├─ Realism: 15/15 (weighted: 15)
└─ Strategic: 10/10 (weighted: 10)
```

### 6. Profile & Resume API
**File:** `api/profile/resume.js`

**Endpoints:**
- `GET /api/profile/resume` - Get current profile
- `POST /api/profile/resume` - Create/update profile
- `PUT /api/profile/resume` - Update specific fields

**Profile Schema:**
```json
{
  "name": "Your Name",
  "email": "you@example.com",
  "years_of_experience": 5,
  "skills": ["JavaScript", "React", "Node.js"],
  "preferred_roles": ["Full Stack Developer", "Backend Engineer"],
  "preferred_locations": ["London", "Amsterdam", "Berlin"],
  "target_countries": ["GB", "NL", "DE"],
  "resume_text": "Full resume text...",
  "resume_url": "https://..."
}
```

### 7. Government Visa Registry Importers
**File:** `scripts/import-visa-registries.js`

**Automated Data Collection:**
- ✅ **UK**: Home Office CSV (20,000+ companies)
- ✅ **Netherlands**: IND website scraping
- ⚠️ **Germany**: Manual (no public registry)
- ⚠️ **Sweden**: Manual (no public registry)
- ⚠️ **Australia**: Quarterly PDFs
- ⚠️ **Canada**: No complete LMIA list

**Run Import:**
```bash
node scripts/import-visa-registries.js
```

## 📊 Salary Thresholds (Pre-populated)

| Country | Visa Type | Currency | Minimum | Notes |
|---------|-----------|----------|---------|-------|
| 🇬🇧 UK | Skilled Worker | GBP | £26,200 | Going rate minimum |
| 🇬🇧 UK | Skilled Worker | GBP | £38,700 | General threshold |
| 🇳🇱 NL | Highly Skilled | EUR | €45,000 | Under 30 years |
| 🇳🇱 NL | Highly Skilled | EUR | €57,000 | Over 30 years |
| 🇩🇪 DE | EU Blue Card | EUR | €45,300 | General |
| 🇩🇪 DE | EU Blue Card | EUR | €41,042 | Shortage occupations |
| 🇸🇪 SE | Work Permit | SEK | 13,000 | Monthly pre-tax |
| 🇦🇺 AU | TSS | AUD | $70,000 | Annual |
| 🇨🇦 CA | LMIA | CAD | $27/hr | Median wage |

## 🔧 Configuration

All scoring weights are configurable in the `scoring_config` table:

```sql
UPDATE scoring_config
SET visa_weight = 60,        -- Increase visa importance
    relevance_weight = 20,
    realism_weight = 10,
    strategic_weight = 10
WHERE config_name = 'default';
```

## 🚀 Next Steps (Phase 2)

### Job Board API Integrations
1. **Reed API** (UK)
2. **Adzuna API** (Multi-country)
3. **Jooble API** (Global)
4. **Jobtech Dev** (Sweden)
5. **Job Bank Canada**

### Automation
- GitHub Actions workflow for:
  - Scheduled job fetching (every 48 hours)
  - Registry updates (weekly)
  - Data cleanup (monthly)

## 📝 How to Use

### 1. Run Migrations
```bash
# Apply schema
psql $DATABASE_URL -f migrations/002_phase1_enhancements.sql
```

### 2. Import Government Data
```bash
# Import UK & NL sponsor registries
node scripts/import-visa-registries.js
```

### 3. Create Your Profile
```bash
curl -X POST https://your-domain.vercel.app/api/profile/resume \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Your Name",
    "years_of_experience": 5,
    "skills": ["JavaScript", "React", "Python"],
    "target_countries": ["GB", "NL", "DE"]
  }'
```

### 4. Bulk Import Jobs
```bash
curl -X POST https://your-domain.vercel.app/api/ingest/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "urls": ["https://job-url-1", "https://job-url-2"]
  }'
```

### 5. Query Scored Jobs
```bash
curl https://your-domain.vercel.app/api/jobs?min_score=80
```

## 🎨 Key Features

✅ Configurable scoring system  
✅ Multi-tier visa intelligence  
✅ Government registry integration  
✅ Bulk URL import  
✅ Enhanced data extraction  
✅ Salary threshold validation  
✅ Community intelligence ready  
✅ Profile-based relevance matching  
✅ Comprehensive job metadata  

## 💡 Innovation: The Visa-Centric USP

This is not just another job board. This is **visa sponsorship intelligence** that:

1. **Validates** companies against official government registries
2. **Analyzes** community sentiment (Reddit, Glassdoor)
3. **Detects** red flags in job descriptions
4. **Calculates** realistic application chances
5. **Prioritizes** jobs with highest visa probability

Traditional job boards show you jobs. JobScanAI shows you **realistic immigration opportunities**.

---

**Status:** ✅ Phase 1 Complete - Ready for Phase 2
