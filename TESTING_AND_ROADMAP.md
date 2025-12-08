# JobScanAI - Testing Guide & Implementation Roadmap

**Last Updated:** December 8, 2024  
**Current Status:** Phase 1 & 1.5 COMPLETE - Ready for Testing

---

## ✅ COMPLETED IMPLEMENTATIONS

### **Phase 1: Foundation (COMPLETE)**

#### Database Schema
- ✅ `job_raw` - Raw HTML storage
- ✅ `job_normalized` - Processed job data
- ✅ `user_profile` - User preferences & resume
- ✅ `visa_sponsor_registry` - Government visa sponsor lists
- ✅ `visa_salary_thresholds` - Country-specific salary requirements
- ✅ `bulk_import_jobs` - Bulk import tracking
- ✅ `scoring_config` - Configurable scoring weights
- ✅ `ingestion_log` - Error tracking

#### Core APIs
- ✅ `/api/ingest/manual` - Single URL import
- ✅ `/api/ingest/bulk` - Bulk URL import (CSV/JSON)
- ✅ `/api/profile/resume` - Basic profile management
- ✅ `/api/jobs` - Job listing with filters

#### Processing Pipeline
- ✅ HTML normalization with skill/domain extraction
- ✅ Visa intelligence (registry matching, keyword detection)
- ✅ Enhanced scoring system with configurable weights
- ✅ Background job processing

#### Scripts
- ✅ `scripts/import-visa-registries.js` - Import UK/AU/CA/NL sponsor lists

---

### **Phase 1.5: Multi-Score System (COMPLETE)**

#### Enhanced Database
- ✅ Skill categorization columns (domain, core PM, tools, technical)
- ✅ `profile_versions` table for audit trail
- ✅ Multi-score columns (visa_score, resume_match_score, job_relevance_score, overall_score)
- ✅ Score breakdown JSONB field

#### Enhanced Profile API
- ✅ `/api/profile/resume-enhanced` - Categorized skills, salary expectations, role flexibility
- ✅ Automatic version tracking for profile changes

#### Multi-Score Algorithm
- ✅ **Visa Score (0-100):** Registry (40) + Activity (20) + Community (20) + Keywords (10) + Salary (10)
- ✅ **Resume Match Score (0-100):** Domain (50%) > Core PM (30%) > Tools (15%) > Tech (5%)
- ✅ **Job Relevance Score (0-100):** Location (25) + Salary (25) + Role (25) + Experience (15) + Industry (10)
- ✅ **Overall Score:** Weighted combination (Visa 40% + Resume 35% + Relevance 25%)

#### Integration
- ✅ Bulk import now uses multi-score algorithm
- ✅ Jobs API returns multi-score data with filtering

---

## 🧪 TESTING CHECKLIST

### **TEST GROUP 1: Profile Management**

#### ✅ T1.1: Create Enhanced Profile
**Status:** PASSED  
**Endpoint:** `POST /api/profile/resume-enhanced`  
**What to Test:**
- Create profile with categorized skills
- Verify salary expectations saved
- Verify role flexibility saved
- Check profile versioning works

**Example Test:**
```bash
curl -X POST https://jobscanai.vercel.app/api/profile/resume-enhanced \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bharath Raghu",
    "email": "bharathvraghu@gmail.com",
    "years_of_experience": 9,
    "skills_must_have_domain": ["Payment Processing", "PSP", "UPI"],
    "salary_expectation": {"min": 70000, "max": 120000, "currency": "GBP"}
  }'
```

#### ⏳ T1.2: Update Profile (Partial)
**Status:** PENDING  
**Endpoint:** `PUT /api/profile/resume-enhanced`  
**What to Test:**
- Update only specific fields
- Verify version snapshot created
- Check changed_fields tracked correctly

#### ⏳ T1.3: Retrieve Profile
**Status:** PENDING  
**Endpoint:** `GET /api/profile/resume-enhanced`  
**What to Test:**
- Retrieve current profile
- Verify all fields present

---

### **TEST GROUP 2: Job Ingestion**

#### ⏳ T2.1: Single URL Import
**Status:** PENDING  
**Endpoint:** `POST /api/ingest/manual`  
**What to Test:**
- Import a single job URL
- Verify HTML stored in job_raw
- Verify normalization happens
- Verify multi-score calculated
- Check job appears in database

**Example Test:**
```bash
curl -X POST https://jobscanai.vercel.app/api/ingest/manual \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://jobs.lever.co/revolut/..."
  }'
```

**Expected Response:**
```json
{
  "message": "Job ingested successfully",
  "job_id": 1,
  "scores": {
    "overall": 87,
    "visa": 85,
    "resume_match": 92,
    "job_relevance": 84
  }
}
```

#### ⏳ T2.2: Bulk URL Import
**Status:** PENDING  
**Endpoint:** `POST /api/ingest/bulk`  
**What to Test:**
- Import multiple URLs (5-10 jobs)
- Verify batch processing works
- Check success/failure counts
- Verify all jobs scored

**Example Test:**
```bash
curl -X POST https://jobscanai.vercel.app/api/ingest/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      "https://jobs.lever.co/revolut/job1",
      "https://careers.stripe.com/job2",
      "https://boards.greenhouse.io/wise/job3"
    ],
    "source_type": "test_batch"
  }'
```

#### ⏳ T2.3: Duplicate URL Handling
**Status:** PENDING  
**What to Test:**
- Try importing same URL twice
- Verify duplicate detection works
- Check error message

---

### **TEST GROUP 3: Job Retrieval & Filtering**

#### ⏳ T3.1: Get All Jobs
**Status:** PENDING  
**Endpoint:** `GET /api/jobs`  
**What to Test:**
- Retrieve all jobs
- Verify multi-score data returned
- Check default sorting (by overall_score)

**Example Test:**
```bash
curl https://jobscanai.vercel.app/api/jobs
```

#### ⏳ T3.2: Filter by Overall Score
**Status:** PENDING  
**What to Test:**
- Filter jobs with min_overall_score=80
- Verify only high-scoring jobs returned

**Example Test:**
```bash
curl "https://jobscanai.vercel.app/api/jobs?min_overall_score=80"
```

#### ⏳ T3.3: Filter by Visa Score
**Status:** PENDING  
**What to Test:**
- Filter by visa score (min_visa_score=70)
- Check visa sponsorship likelihood

**Example Test:**
```bash
curl "https://jobscanai.vercel.app/api/jobs?min_visa_score=70"
```

#### ⏳ T3.4: Filter by Location
**Status:** PENDING  
**What to Test:**
- Filter by country (e.g., London)
- Verify location filtering works

**Example Test:**
```bash
curl "https://jobscanai.vercel.app/api/jobs?country=London&min_overall_score=75"
```

#### ⏳ T3.5: Sort by Different Scores
**Status:** PENDING  
**What to Test:**
- Sort by visa_score
- Sort by resume_match_score
- Sort by job_relevance_score

**Example Test:**
```bash
curl "https://jobscanai.vercel.app/api/jobs?sort_by=visa_score&limit=10"
```

---

### **TEST GROUP 4: Visa Registry Import**

#### ⏳ T4.1: Import UK Sponsor Registry
**Status:** PENDING  
**Script:** `node scripts/import-visa-registries.js`  
**What to Test:**
- Download UK sponsor list
- Parse CSV correctly
- Import to database
- Verify sponsor count

#### ⏳ T4.2: Import AU Sponsor Registry
**Status:** PENDING  
**What to Test:**
- Same as UK but for Australia

#### ⏳ T4.3: Registry Matching in Scoring
**Status:** PENDING  
**What to Test:**
- Import job from known sponsor
- Verify registry_match = true in visa_score
- Check score boost applied

---

### **TEST GROUP 5: End-to-End Workflow**

#### ⏳ T5.1: Complete User Journey
**Status:** PENDING  
**Steps:**
1. Create enhanced profile with YOUR actual data
2. Import 10 real job URLs from target companies
3. Retrieve jobs sorted by overall_score
4. Verify top 3 jobs have high scores
5. Check score breakdowns make sense
6. Verify recommendations (APPLY NOW vs SKIP)

#### ⏳ T5.2: Scoring Validation
**Status:** PENDING  
**What to Test:**
- Import a job that's PERFECT match (payments role at Revolut in London)
  - Expected: overall_score > 85, resume_match > 90
- Import a job that's POOR match (Java dev role, no visa sponsorship)
  - Expected: overall_score < 50, visa_score < 30
- Import a job that's MEDIUM match (PM role but wrong location)
  - Expected: overall_score 60-75

---

## 🚧 REMAINING PHASES BEFORE LAYER 3

### **Phase 2: Job Board API Integrations (NOT STARTED)**

**Goal:** Automatically fetch jobs from external APIs instead of manual URL entry

#### P2.1: LinkedIn Jobs API Integration
- [ ] Setup LinkedIn API credentials
- [ ] Create `/api/sources/linkedin` endpoint
- [ ] Implement job search by keywords + location
- [ ] Map LinkedIn job structure to our schema
- [ ] Test with "Product Manager Payments London"

#### P2.2: Greenhouse API Integration
- [ ] Research Greenhouse public job boards
- [ ] Create scraper for Greenhouse-hosted career pages
- [ ] Examples: Stripe, Wise, Airbnb careers pages

#### P2.3: Lever.co Integration
- [ ] Similar to Greenhouse
- [ ] Examples: Revolut, N26, Monzo

#### P2.4: Indeed API Integration
- [ ] Indeed Job Search API
- [ ] Filter by visa sponsorship keywords

#### P2.5: Scheduled Auto-Fetch
- [ ] Create cron job (daily)
- [ ] Auto-fetch from all sources
- [ ] Store in bulk_import_jobs

**Estimated Effort:** 2-3 weeks

---

### **Phase 2.5: Data Quality & Enrichment (NOT STARTED)**

#### P2.5.1: Company Data Enrichment
- [ ] Integrate Clearbit API for company data
- [ ] Add company size, funding, industry
- [ ] Store in new `companies` table

#### P2.5.2: Salary Data Enhancement
- [ ] Integrate Glassdoor/Levels.fyi data
- [ ] Fill missing salary ranges
- [ ] Normalize all salaries to GBP

#### P2.5.3: Location Geocoding
- [ ] Use Google Maps API
- [ ] Convert locations to lat/lng
- [ ] Enable distance-based filtering

**Estimated Effort:** 1-2 weeks

---

### **Phase 3: Intelligence Layer - Community Signals (NOT STARTED)**

**Goal:** Gather real visa sponsorship experiences from Reddit, Blind, etc.

#### P3.1: Reddit Scraper
- [ ] Scrape r/IWantOut, r/UKVisa, r/cscareerquestions
- [ ] Extract company mentions + visa outcomes
- [ ] Sentiment analysis (positive/negative)
- [ ] Store in `community_signals` table

#### P3.2: Blind Integration
- [ ] Scrape Blind discussions
- [ ] Focus on visa sponsorship topics
- [ ] Company-specific threads

#### P3.3: Signal Aggregation
- [ ] Aggregate signals per company
- [ ] Calculate confidence scores
- [ ] Feed into visa_score calculation

**Estimated Effort:** 2-3 weeks

---

### **Phase 3.5: Advanced Scoring (NOT STARTED)**

#### P3.5.1: Historical Success Rate
- [ ] Track application outcomes (if user provides)
- [ ] Calculate success rate per company/role
- [ ] Adjust scores based on historical data

#### P3.5.2: Time-Decay for Job Posts
- [ ] Reduce score for old postings (>30 days)
- [ ] Boost recently posted jobs

#### P3.5.3: Application Competition Estimation
- [ ] Estimate number of applicants
- [ ] Factor into realism score

**Estimated Effort:** 1 week

---

## 📊 CURRENT ARCHITECTURE STATUS

### **What's Working:**
✅ Database with 8+ tables  
✅ Profile management with skill categorization  
✅ Job ingestion (manual + bulk)  
✅ HTML normalization  
✅ Visa registry matching (UK, AU, CA, NL)  
✅ Multi-score algorithm (3 scores → 1 overall)  
✅ Job retrieval with advanced filtering  
✅ Background processing  

### **What's Missing for Layer 3:**
❌ External API integrations (LinkedIn, Indeed, etc.)  
❌ Automated job fetching (cron jobs)  
❌ Community intelligence scraping (Reddit, Blind)  
❌ Company data enrichment  
❌ Historical tracking & ML improvements  

---

## 🎯 RECOMMENDED NEXT STEPS

### **Option A: Complete Testing First (Recommended)**
1. ✅ Run all tests in TEST GROUP 1-5
2. ✅ Fix any bugs found
3. ✅ Validate scoring makes sense with real jobs
4. ✅ Create test dataset of 50+ jobs
5. → Then move to Phase 2

### **Option B: Start Phase 2 Now**
1. → Implement LinkedIn API integration
2. → Test with automated job fetching
3. → Then backfill testing

### **Option C: Start Phase 3 (Community Signals)**
1. → Build Reddit scraper
2. → Integrate community data into scoring
3. → Then backfill API integrations

---

## 📈 TIMELINE ESTIMATE TO LAYER 3

**If we test thoroughly first:**
- Testing & Bug Fixes: 3-5 days
- Phase 2 (APIs): 2-3 weeks
- Phase 2.5 (Enrichment): 1-2 weeks
- Phase 3 (Community): 2-3 weeks
- **Total: 6-9 weeks to Layer 3**

**If we rush to Layer 3:**
- Phase 2 + 3 (parallel): 3-4 weeks
- Testing backfill: 1 week
- **Total: 4-5 weeks (but higher risk)**

---

## 🚀 YOUR DECISION NEEDED

**What would you like to do next?**

1. **THOROUGH TESTING:** Run through all test cases (T1.1 - T5.2)
2. **START PHASE 2:** Begin LinkedIn/Indeed API integrations
3. **START PHASE 3:** Build Reddit/community scraping
4. **CUSTOM PATH:** Mix of testing + new features

Let me know and we'll proceed accordingly!
