# JobScanAI - REVISED Implementation Roadmap

**Last Updated:** December 8, 2024  
**Current Status:** Phase 1 & 1.5 COMPLETE - Moving to Phase 2 TODAY

---

## ✅ COMPLETED PHASES

### **Phase 1: Foundation** ✅ (COMPLETE)
1. ✅ Bulk URL import (CSV + manual) - `/api/ingest/bulk`
2. ✅ Enhanced visa intelligence with gov data importers - `scripts/import-visa-registries.js`
3. ✅ Better scoring with configurable weights - `scoring_config` table
4. ✅ Resume/profile storage - `user_profile` table

### **Phase 1.5: Multi-Score Enhancement** ✅ (COMPLETE - Bonus Feature)
1. ✅ Skill categorization (Domain > Core PM > Tools > Tech)
2. ✅ Multi-score algorithm (Visa 40% + Resume 35% + Relevance 25%)
3. ✅ Profile versioning for audit trail
4. ✅ Enhanced jobs API with multi-score filtering

---

## 🎯 CURRENT FOCUS: PHASE 2 (API Integrations)

**Goal:** Complete by EOD TODAY (December 8, 2024)  
**Status:** NOT STARTED

### **Phase 2: Job Board API Integrations** (Target: EOD Today)

Based on your geography matrix and API access:

#### P2.1: Reed API (UK) 🇬🇧
**Priority:** HIGH  
**API:** Reed Jobseeker API (free dev key)  
**Tasks:**
- [ ] Setup Reed API credentials in .env
- [ ] Create `/api/sources/reed.js` endpoint
- [ ] Implement job search (keywords: "Product Manager Payments", "Fintech PM")
- [ ] Map Reed job structure to our `job_normalized` schema
- [ ] Test with UK-based PM roles
- [ ] Filter for visa sponsorship keywords

**Deliverables:**
- Fetch 50+ UK PM jobs from Reed
- Store in database with multi-score
- Verify visa_score uses UK sponsor registry

---

#### P2.2: Adzuna Multi-Geo API 🌍
**Priority:** HIGH  
**API:** Adzuna Free Developer Tier  
**Geographies:** UK, NL, DE, SE, AU, CA, EU  
**Tasks:**
- [ ] Setup Adzuna API credentials
- [ ] Create `/api/sources/adzuna.js` endpoint
- [ ] Implement multi-country job fetching:
  - `adzuna.co.uk` (UK)
  - `adzuna.nl` (Netherlands)
  - `adzuna.de` (Germany)
  - `adzuna.se` (Sweden)
  - `adzuna.com.au` (Australia)
  - `adzuna.ca` (Canada)
- [ ] Map Adzuna job structure to our schema
- [ ] Batch fetch per geography
- [ ] Test with "Product Manager" + "Payments" keywords

**Deliverables:**
- Fetch 20+ jobs per geography
- Total: 120+ jobs across 6 countries
- Multi-score all jobs

---

#### P2.3: Jooble API (Backup/Supplement) 🔄
**Priority:** MEDIUM  
**API:** Jooble Free API  
**Geographies:** UK, NL, DE, SE, AU, CA  
**Tasks:**
- [ ] Setup Jooble API credentials
- [ ] Create `/api/sources/jooble.js` endpoint
- [ ] Implement as fallback when Reed/Adzuna have low results
- [ ] Support same geographies as Adzuna

**Deliverables:**
- Supplementary source for low-volume geos
- Fetch 50+ additional jobs

---

#### P2.4: Jobtech Dev API (Sweden) 🇸🇪
**Priority:** HIGH (for Sweden)  
**API:** Arbetsförmedlingen Jobtech Dev (Free official API)  
**Tasks:**
- [ ] Setup Jobtech Dev API access
- [ ] Create `/api/sources/jobtech.js` endpoint
- [ ] Fetch Swedish PM roles
- [ ] Map to our schema

**Deliverables:**
- Primary source for Swedish jobs
- 30+ Swedish PM roles

---

#### P2.5: Make-it-in-Germany Portal (Germany) 🇩🇪
**Priority:** MEDIUM  
**Method:** Public HTML crawl (within ToS) using HTTP fetch + Cheerio  
**Tasks:**
- [ ] Check robots.txt for Make-it-in-Germany portal
- [ ] Create `/api/sources/make-it-germany.js` scraper
- [ ] Use HTTP fetch + Cheerio (no Puppeteer)
- [ ] Extract job listings
- [ ] Run 1× per 2 days (as per your matrix)

**Deliverables:**
- 20+ German govt portal jobs
- Respects ToS and robots.txt

---

#### P2.6: Scheduled Auto-Fetch System ⏰
**Priority:** HIGH  
**Tasks:**
- [ ] Create `/api/cron/fetch-jobs.js` endpoint
- [ ] Setup Vercel Cron job (daily at 2 AM UTC)
- [ ] Orchestrate all sources:
  - Reed (UK) - daily
  - Adzuna (all geos) - daily
  - Jooble (as supplement) - daily
  - Jobtech (Sweden) - daily
  - Make-it-Germany - every 2 days
- [ ] Store fetch logs in `bulk_import_jobs` table
- [ ] Email summary report (optional)

**Deliverables:**
- Automated daily job fetching
- 200-300 new jobs per day across all sources

---

#### P2.7: UAE (Indeed Public Search via SERP) 🇦🇪
**Priority:** LOW (Manual for now)  
**Method:** SERP intelligence layer (Phase 3)  
**Tasks:**
- [ ] Defer to Phase 3 (SERP intelligence)
- [ ] For MVP: Manual URL ingestion for UAE jobs

**Deliverables:**
- Handled in Phase 3 SERP layer

---

### **Phase 2 Summary:**
- **Total APIs:** 5 (Reed, Adzuna, Jooble, Jobtech, Make-it-Germany)
- **Geographies:** 6+ (UK, NL, DE, SE, AU, CA)
- **Expected Jobs:** 300-400 jobs in database after Phase 2
- **Timeline:** Complete by EOD TODAY

---

## 🔍 PHASE 3: Intelligence Layer (Start TOMORROW)

**Goal:** SERP intelligence, company watcher, duplicate filtering  
**Timeline:** December 9-10, 2024

### **Phase 3.1: SERP Intelligence Layer**
**Purpose:** Extract visa sponsorship signals from Google Search results

**Tasks:**
- [ ] Create `/api/intelligence/serp.js` endpoint
- [ ] Use SerpAPI or Serper.dev for Google searches
- [ ] Search queries:
  - `"{company name}" visa sponsorship reddit`
  - `"{company name}" tier 2 sponsor uk`
  - `"{company name}" H1B sponsor`
- [ ] Extract snippets mentioning visa outcomes
- [ ] Sentiment analysis (positive/negative)
- [ ] Store in `community_signals` table
- [ ] Feed into `visa_score` calculation

**Deliverables:**
- SERP-based visa intelligence for top 100 companies
- Enhanced visa_score accuracy

---

### **Phase 3.2: Company Watcher**
**Purpose:** Track companies of interest for new job postings

**Tasks:**
- [ ] Create `watched_companies` table
- [ ] Allow user to "watch" companies (e.g., Revolut, Stripe, Wise)
- [ ] Create `/api/companies/watch` endpoint
- [ ] Daily check: Has watched company posted new jobs?
- [ ] Email/notification when new job found
- [ ] Store in `company_watch_log` table

**Deliverables:**
- Watch 20+ target companies
- Daily alerts for new postings

---

### **Phase 3.3: Enhanced Duplicate/Spam Filtering**
**Purpose:** Prevent duplicate jobs, filter spam/recruiter posts

**Tasks:**
- [ ] Implement fuzzy matching for job titles (using Levenshtein distance)
- [ ] Detect duplicate jobs across sources:
  - Same company + similar title + same location = duplicate
- [ ] Spam detection:
  - Filter jobs with >3 recruiter emails
  - Filter jobs with suspicious keywords ("urgent hiring", "immediate start")
  - Filter low-quality JDs (< 100 words)
- [ ] Create `duplicate_jobs` table for tracking
- [ ] Add `is_spam` flag to `job_normalized`

**Deliverables:**
- 90%+ duplicate detection accuracy
- Spam filtering reduces noise by 30%+

---

### **Phase 3 Summary:**
- **Components:** SERP intelligence, Company watcher, Duplicate filtering
- **Timeline:** 2 days (Dec 9-10)

---

## 🎨 PHASE 4: Dashboard/UI (REQUIRED BEFORE LAYER 3)

**Goal:** Build user-facing dashboard  
**Timeline:** December 11-13, 2024 (3 days)

### **Phase 4.1: List View**
**Tasks:**
- [ ] Create `/dashboard` page (Next.js or React)
- [ ] Display jobs in card/list format
- [ ] Show key fields:
  - Job title, company, location
  - Overall score (with color coding: green >80, yellow 60-80, red <60)
  - Visa score, Resume score, Relevance score (badges)
  - Salary range
  - Posted date
- [ ] Sorting:
  - By overall_score (default)
  - By visa_score
  - By posted date
- [ ] Filtering:
  - By country (dropdown)
  - By min_overall_score (slider)
  - By company (search box)
- [ ] Pagination (50 jobs per page)

**Deliverables:**
- Responsive job list view
- Multi-score visualization

---

### **Phase 4.2: Detail View**
**Tasks:**
- [ ] Click job card → open detail modal/page
- [ ] Show full job description
- [ ] Show score breakdown:
  - Visa score components (registry, activity, keywords)
  - Resume match components (domain, core PM, tools)
  - Relevance components (location, salary, role)
- [ ] Show recommendation (APPLY NOW, CONSIDER, SKIP)
- [ ] Show "Why this scores high/low" reasoning
- [ ] "Apply" button → opens job URL in new tab
- [ ] "Save for later" button

**Deliverables:**
- Detailed job view with score explanations
- Clear recommendations

---

### **Phase 4.3: Analytics/Filters**
**Tasks:**
- [ ] Dashboard stats:
  - Total jobs tracked
  - High-scoring jobs (>80)
  - Jobs by country (pie chart)
  - Average visa_score by company (bar chart)
- [ ] Advanced filters:
  - Multi-select countries
  - Salary range slider
  - Skills filter (match your domain skills)
- [ ] Export to CSV (for offline tracking)

**Deliverables:**
- Analytics dashboard
- Advanced filtering

---

### **Phase 4 Summary:**
- **Components:** List view, Detail view, Analytics
- **Tech Stack:** Next.js/React + Tailwind CSS
- **Timeline:** 3 days (Dec 11-13)

---

## 🧪 REVISED TESTING CHECKLIST

### **TEST GROUP 1: Profile Management** ✅
- ✅ T1.1: Create Enhanced Profile - PASSED
- ⏳ T1.2: Update Profile (Partial)
- ⏳ T1.3: Retrieve Profile

---

### **TEST GROUP 2: Visa Registry Import** (DO THIS FIRST!)
**Why first?** Visa scores depend on registry data

#### ⏳ T2.1: Import UK Sponsor Registry
**Command:**
```bash
node scripts/import-visa-registries.js
```
**What to verify:**
- UK sponsor CSV downloaded
- Parsed correctly
- Imported to `visa_sponsor_registry` table
- Query: `SELECT COUNT(*) FROM visa_sponsor_registry WHERE country_code = 'GB';`
- Expected: 30,000+ sponsors

#### ⏳ T2.2: Import NL Sponsor Registry
**What to verify:**
- IND Recognised Sponsors CSV imported
- Expected: 5,000+ sponsors

#### ⏳ T2.3: Import AU/CA Registries
**What to verify:**
- Australia and Canada sponsor lists imported

**After completion, verify registry matching works in scoring**

---

### **TEST GROUP 3: Job Ingestion**

#### ⏳ T3.1: Single URL Import
**Test with known UK sponsor (e.g., Revolut):**
```bash
curl -X POST https://jobscanai.vercel.app/api/ingest/manual \
  -H "Content-Type: application/json" \
  -d '{"url": "https://jobs.lever.co/revolut/..."}'
```

**Expected:**
- `visa_score` should be HIGH (>70) if company in UK registry
- `score_breakdown.visa.registry_match.status` = "confirmed"

#### ⏳ T3.2: Bulk URL Import (5-10 jobs)
**Test with mix of sponsors and non-sponsors**

#### ⏳ T3.3: Duplicate Handling
**Import same URL twice, verify rejection**

---

### **TEST GROUP 4: Job Retrieval & Filtering**

#### ⏳ T4.1: Get All Jobs
```bash
curl https://jobscanai.vercel.app/api/jobs
```

#### ⏳ T4.2: Filter by Overall Score
```bash
curl "https://jobscanai.vercel.app/api/jobs?min_overall_score=80"
```

#### ⏳ T4.3: Filter by Visa Score
```bash
curl "https://jobscanai.vercel.app/api/jobs?min_visa_score=70"
```

#### ⏳ T4.4: Filter by Location
```bash
curl "https://jobscanai.vercel.app/api/jobs?country=London"
```

#### ⏳ T4.5: Sort by Different Scores
```bash
curl "https://jobscanai.vercel.app/api/jobs?sort_by=visa_score&limit=10"
```

---

### **TEST GROUP 5: Phase 2 API Sources** (After implementation)

#### ⏳ T5.1: Reed API
```bash
curl "https://jobscanai.vercel.app/api/sources/reed?keywords=Product+Manager+Payments&location=London"
```

#### ⏳ T5.2: Adzuna Multi-Geo
```bash
curl "https://jobscanai.vercel.app/api/sources/adzuna?country=GB&keywords=Product+Manager"
```

#### ⏳ T5.3: Jobtech (Sweden)
```bash
curl "https://jobscanai.vercel.app/api/sources/jobtech?keywords=Product+Manager"
```

---

### **TEST GROUP 6: End-to-End Workflow**

#### ⏳ T6.1: Complete User Journey
1. Create enhanced profile ✅
2. Import UK sponsor registry
3. Run Reed API fetch (50 UK jobs)
4. Run Adzuna API fetch (100+ jobs across geos)
5. Retrieve jobs sorted by overall_score
6. Verify top 10 jobs have high scores
7. Check score breakdowns make sense

#### ⏳ T6.2: Scoring Validation
- Perfect match job: overall_score >85, visa_score >80, resume_score >90
- Poor match job: overall_score <50, visa_score <30
- Medium match job: overall_score 60-75

---

## 📊 IMPLEMENTATION STATUS

### **COMPLETED:**
- ✅ Phase 1: Foundation (100%)
- ✅ Phase 1.5: Multi-Score Enhancement (100%)

### **IN PROGRESS:**
- 🔄 Testing: Test Groups 1-4 (30% complete)

### **STARTING TODAY:**
- 🚀 Phase 2: Job Board APIs (Target: EOD)

### **STARTING TOMORROW:**
- ⏳ Phase 3: Intelligence Layer (Dec 9-10)

### **NEXT:**
- ⏳ Phase 4: Dashboard/UI (Dec 11-13)

### **THEN:**
- ⏳ Layer 3: Advanced AI/ML features

---

## ⏱️ REVISED TIMELINE

### **Week 1 (Dec 8-13, 2024):**
- ✅ Dec 8 AM: Phase 1 & 1.5 complete
- 🎯 Dec 8 EOD: Phase 2 complete (APIs integrated)
- 🎯 Dec 9-10: Phase 3 complete (Intelligence layer)
- 🎯 Dec 11-13: Phase 4 complete (Dashboard/UI)

### **After Dashboard:**
- ✅ All Phase 1-4 complete
- ✅ Ready for Layer 3 (AI/ML enhancements)

**Total Timeline to Layer 3:** 6 days (Dec 8-13)

---

## 🚀 IMMEDIATE ACTIONS (TODAY - Dec 8)

### **Morning (10 AM - 2 PM):**
1. ✅ Complete Test Group 2 (Visa Registry Import)
2. ✅ Complete Test Group 3 (Job Ingestion)
3. ✅ Complete Test Group 4 (Job Retrieval)

### **Afternoon (2 PM - 6 PM):**
4. 🚀 Implement Reed API (P2.1)
5. 🚀 Implement Adzuna Multi-Geo (P2.2)
6. 🚀 Test API integrations with live data

### **Evening (6 PM - 10 PM):**
7. 🚀 Implement Jooble API (P2.3)
8. 🚀 Implement Jobtech API (P2.4)
9. 🚀 Setup Cron system (P2.6)

**By EOD:** 300+ jobs in database from multiple sources

---

## 📋 KEY DECISIONS & CONSTRAINTS

### **Scraping Policy:**
✅ **ALLOWED:**
- Official APIs (Reed, Adzuna, Jooble, Jobtech)
- HTTP fetch + Cheerio for public pages (Make-it-Germany portal)
- Respect robots.txt

❌ **NOT ALLOWED:**
- LinkedIn scraping (use manual ingestion)
- Indeed scraping (defer to SERP or manual)
- Puppeteer/headless browsers
- External scraping services (ScraperAPI, etc.)
- Sites that block bots

### **API Credentials (You Have):**
- Reed API key
- Adzuna API credentials
- Jooble API key
- Jobtech Dev access

### **Data Sources Priority:**
1. **Official APIs** (Reed, Adzuna, Jooble, Jobtech) - HIGHEST
2. **Public portals** (Make-it-Germany) - MEDIUM
3. **SERP intelligence** (Phase 3) - MEDIUM
4. **Manual ingestion** (LinkedIn, Indeed) - FALLBACK

---

## 🎯 SUCCESS METRICS

### **Phase 2 Success Criteria:**
- [ ] 50+ UK jobs from Reed
- [ ] 100+ jobs from Adzuna (across 6 geos)
- [ ] 50+ jobs from Jooble
- [ ] 30+ Swedish jobs from Jobtech
- [ ] Cron job scheduled and tested
- [ ] All jobs have multi-scores calculated
- [ ] Visa registry matching verified

### **Phase 3 Success Criteria:**
- [ ] SERP intelligence for 50+ companies
- [ ] Company watcher for 20+ companies
- [ ] Duplicate detection >90% accuracy
- [ ] Spam filtering reduces noise by 30%+

### **Phase 4 Success Criteria:**
- [ ] Responsive dashboard deployed
- [ ] List view with sorting/filtering
- [ ] Detail view with score explanations
- [ ] Analytics charts working
- [ ] Export to CSV functional

---

## 🔄 PARALLEL WORKFLOW (TODAY)

### **Track 1: Testing** (You run tests)
- T2.1: Import UK registry
- T2.2: Import NL registry
- T2.3: Import AU/CA registries
- T3.1: Test single URL import
- T3.2: Test bulk import
- T4.1-T4.5: Test job retrieval

### **Track 2: Development** (I implement)
- P2.1: Reed API integration
- P2.2: Adzuna Multi-Geo
- P2.3: Jooble API
- P2.4: Jobtech API
- P2.6: Cron system

**Coordination:**
- You provide API keys when ready
- I implement and commit code
- You test each API endpoint as it's deployed
- We verify jobs appear in database with correct scores

---

## 📞 READY TO START?

**Confirm to proceed with:**

1. **IMMEDIATE:** Start Test Group 2 (Visa Registry Import)
   - I'll guide you through running the import script
   - Verify registry data in database

2. **PARALLEL:** I start implementing Reed API (P2.1)
   - You provide Reed API key when ready
   - I'll create the endpoint and test

3. **SEQUENCE:** Continue with Adzuna, Jooble, Jobtech
   - Each API gets implemented and tested
   - By EOD we have 300+ jobs in database

**Let's go! 🚀**
