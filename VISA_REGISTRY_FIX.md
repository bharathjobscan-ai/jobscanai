# Visa Registry Import Fix

## Issues Identified

1. **Hardcoded company list**: Script was using only 107 hardcoded companies instead of fetching from actual government sources
2. **Wrong CSV URL**: The UK CSV link was outdated (404 error)
3. **Missing database constraint**: No unique constraint on `(company_name, country_code)` causing upsert failures

## Changes Made

### 1. Database Migration (`migrations/004_add_visa_registry_constraint.sql`)
- Added unique constraint on `visa_sponsor_registry(company_name, country_code)`
- Removes any existing duplicates before adding constraint

### 2. Updated Import Script (`scripts/import-visa-registries.js`)
- Fixed UK CSV URL to latest version (December 8, 2025)
- Improved CSV parsing with proper quote handling
- Better error reporting and progress tracking
- Enhanced Netherlands scraping with multiple selector strategies
- Larger batch sizes for efficiency (500 for UK, 100 for NL)

## Next Steps

### Step 1: Run Database Migration
```bash
# Connect to your Supabase project and run the migration
psql $DATABASE_URL -f migrations/004_add_visa_registry_constraint.sql
```

Or run it directly in Supabase SQL Editor:
```sql
-- Copy content from migrations/004_add_visa_registry_constraint.sql
```

### Step 2: Test the Import
```bash
node scripts/import-visa-registries.js
```

### Expected Results
- **UK**: Should import 40,000-50,000+ companies from the official register
- **Netherlands**: May import fewer (website scraping is less reliable)

## What This Enables

With the full UK sponsor registry imported, JobScanAI can now:
1. **Accurately identify visa sponsors** - Match job postings against 40K+ verified UK sponsors
2. **Boost visa scores** - Jobs from registered sponsors get higher scoring
3. **Filter opportunities** - Users can focus only on companies that can sponsor visas
4. **Track trends** - Analyze which companies are actively hiring international talent

## File Changes
- ✅ `scripts/import-visa-registries.js` - Complete rewrite with actual data fetching
- ✅ `migrations/004_add_visa_registry_constraint.sql` - New migration for database constraint

## Previous State vs New State

### Before
- 107 hardcoded companies
- Outdated CSV URL (404)
- No database constraint (causing errors)

### After
- Full UK government registry (~40K+ companies)
- Latest CSV (Dec 8, 2025)
- Proper unique constraint
- Better error handling and progress tracking

## Verification

After running the import, verify with:
```sql
-- Check UK company count
SELECT COUNT(*) FROM visa_sponsor_registry WHERE country_code = 'GB';

-- Check sample companies
SELECT company_name, sponsor_type, raw_data->>'location' 
FROM visa_sponsor_registry 
WHERE country_code = 'GB' 
LIMIT 10;

-- Check for duplicates (should be 0)
SELECT company_name, country_code, COUNT(*) 
FROM visa_sponsor_registry 
GROUP BY company_name, country_code 
HAVING COUNT(*) > 1;
