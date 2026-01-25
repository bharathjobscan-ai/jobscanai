/**
 * Visa Sponsor Registry Import Script
 * 
 * Usage:
 *   node scripts/import-visa-registries.js --country=GB    # UK only
 *   node scripts/import-visa-registries.js --country=NL    # Netherlands only
 *   node scripts/import-visa-registries.js --country=ALL   # All countries (future)
 * 
 * Features:
 * - Batch processing (500 records per batch)
 * - Visual progress bar with ETA
 * - Hybrid upsert with last_seen_fetch_id tracking
 * - Efficient deactivation using indexed column
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

// Validate environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_KEY must be set in .env file');
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Constants
const BATCH_SIZE = 500;

// Registry Sources Configuration
const REGISTRY_SOURCES = {
  GB: {
    name: 'UK Home Office Skilled Worker Sponsor List',
    url: 'https://assets.publishing.service.gov.uk/media/6936bbf1a6fc97b81e57435b/2025-12-08_-_Worker_and_Temporary_Worker.csv',
    type: 'csv',
    sponsorType: 'Skilled Worker'
  },
  NL: {
    name: 'Netherlands IND Recognised Sponsors',
    url: 'https://ind.nl/en/public-register-recognised-sponsors/public-register-regular-labour-and-highly-skilled-migrants',
    type: 'html',
    sponsorType: 'Highly Skilled Migrant'
  }
};

/**
 * Helper: Split array into chunks
 */
function chunkArray(arr, size = BATCH_SIZE) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Helper: Print progress bar
 */
function printProgress(processed, total, startTime, batchNum, totalBatches) {
  const percent = Math.round((processed / total) * 100);
  const filled = Math.round(percent / 5);
  const empty = 20 - filled;
  
  // ETA calculation
  const elapsed = (Date.now() - startTime) / 1000;
  const rate = processed / elapsed; // records per second
  const remaining = total - processed;
  const etaSeconds = remaining / rate;
  
  let eta;
  if (etaSeconds < 60) {
    eta = `${Math.round(etaSeconds)}s`;
  } else if (etaSeconds < 3600) {
    eta = `${Math.round(etaSeconds / 60)}m`;
  } else {
    eta = `${Math.round(etaSeconds / 3600)}h`;
  }
  
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  process.stdout.write(`\r${bar} ${percent}% | ${processed.toLocaleString()}/${total.toLocaleString()} | Batch ${batchNum}/${totalBatches} | ETA: ${eta}`);
}

/**
 * Parse command line arguments
 */
const args = process.argv.slice(2);
let targetCountry = 'GB'; // Default to UK

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  const nextArg = args[i + 1];
  
  if (arg === '--country' || arg === '-c') {
    if (nextArg && !nextArg.startsWith('-')) {
      const countryCode = nextArg.toUpperCase();
      if (REGISTRY_SOURCES[countryCode] || countryCode === 'ALL') {
        targetCountry = countryCode;
      } else {
        console.error(`❌ Unknown country code: ${countryCode}`);
        console.error(`   Available: ${Object.keys(REGISTRY_SOURCES).join(', ')}`);
        process.exit(1);
      }
    }
  } else if (arg.startsWith('--country=')) {
    // Handle --country=NL format
    const countryCode = arg.split('=')[1].toUpperCase();
    if (REGISTRY_SOURCES[countryCode] || countryCode === 'ALL') {
      targetCountry = countryCode;
    }
  }
}

/**
 * Main import function
 */
export async function importRegistry(countryCode = targetCountry) {
  const fetchId = `fetch_${countryCode}_${Date.now()}`;
  const source = REGISTRY_SOURCES[countryCode];
  const startTime = Date.now();
  
  console.log(`\n🚀 Starting visa registry import for ${countryCode}...`);
  console.log(`   Fetch ID: ${fetchId}`);
  console.log(`   Source: ${source.url}`);
  console.log(`   Batch size: ${BATCH_SIZE}\n`);
  
  try {
    // Record import start
    const { data: importRecord, error: importError } = await supabase
      .from('visa_registry_imports')
      .insert({
        fetch_id: fetchId,
        country_code: countryCode,
        source_url: source.url,
        source_type: source.type,
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (importError) {
      throw new Error(`Failed to create import record: ${importError.message}`);
    }

    // Fetch data
    let companies, fetchDate;
    if (countryCode === 'GB') {
      const result = await importUKRegistry();
      companies = result.companies;
      fetchDate = result.fetchDate;
    } else if (countryCode === 'NL') {
      const result = await importNLRegistry();
      companies = result.companies;
      fetchDate = result.fetchDate;
    } else {
      throw new Error(`Country ${countryCode} not yet implemented`);
    }

    console.log(`\n📊 Parsed ${companies.length.toLocaleString()} companies from ${countryCode}\n`);

    if (companies.length === 0) {
      throw new Error('No companies found');
    }

    // Remove duplicates
    const uniqueRecords = deduplicateRecords(companies, countryCode, fetchId, source, fetchDate);
    const totalRecords = uniqueRecords.length;
    const batches = chunkArray(uniqueRecords, BATCH_SIZE);
    const totalBatches = batches.length;

    console.log(`📦 Upserting ${totalRecords.toLocaleString()} unique records in ${totalBatches} batches...\n`);

    // Process batches with progress
    let totalInserted = 0;
    let totalUpdated = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchNum = i + 1;
      
      // Show progress
      const processed = Math.min((i + 1) * BATCH_SIZE, totalRecords);
      printProgress(processed, totalRecords, startTime, batchNum, totalBatches);
      
      // Upsert batch
      const result = await upsertBatch(batch, fetchId);
      totalInserted += result.inserted;
      totalUpdated += result.updated;
    }

    // Clear progress line and show completion
    process.stdout.write('\n\n');

    // Deactivate companies not in current fetch (using last_seen_fetch_id)
    console.log('🔄 Checking for deactivated companies...');
    const deactivatedCount = await deactivateMissingCompanies(countryCode, fetchId);
    console.log(`   → ${deactivatedCount} companies deactivated\n`);

    // Get total active count
    const { count: totalActive } = await supabase
      .from('visa_sponsor_registry')
      .select('id', { count: 'exact', head: true })
      .eq('country_code', countryCode)
      .eq('is_active', true);

    // Calculate elapsed time
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    // Update import record
    await supabase
      .from('visa_registry_imports')
      .update({
        status: 'success',
        completed_at: new Date().toISOString(),
        records_processed: totalRecords,
        records_inserted: totalInserted,
        records_updated: totalUpdated,
        records_deactivated: deactivatedCount,
        raw_summary: {
          batches_processed: totalBatches,
          batch_size: BATCH_SIZE
        }
      })
      .eq('id', importRecord.id);

    // Final summary
    console.log('═'.repeat(50));
    console.log('✅ Import complete!');
    console.log('═'.repeat(50));
    console.log(`   Country: ${countryCode}`);
    console.log(`   Records processed: ${totalRecords.toLocaleString()}`);
    console.log(`   Inserted: ${totalInserted.toLocaleString()}`);
    console.log(`   Updated: ${totalUpdated.toLocaleString()}`);
    console.log(`   Deactivated: ${deactivatedCount.toLocaleString()}`);
    console.log(`   Total active: ${totalActive?.toLocaleString() || '0'}`);
    console.log(`   Time elapsed: ${elapsed}s`);
    console.log('═'.repeat(50) + '\n');

    return {
      status: 'success',
      fetchId,
      country: countryCode,
      inserted: totalInserted,
      updated: totalUpdated,
      deactivated: deactivatedCount,
      totalActive: totalActive || 0
    };

  } catch (error) {
    console.error(`\n❌ Import failed: ${error.message}`);
    
    await supabase
      .from('visa_registry_imports')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: error.message
      })
      .eq('fetch_id', fetchId);

    return { status: 'failed', fetchId, country: countryCode, error: error.message };
  }
}

/**
 * Remove duplicate records
 */
function deduplicateRecords(companies, countryCode, fetchId, source, fetchDate) {
  const seen = new Set();
  const unique = [];
  
  for (const company of companies) {
    const key = `${company.company_name.toLowerCase()}|${countryCode}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(formatRecord(company, countryCode, fetchId, source, fetchDate));
    }
  }
  
  return unique;
}

/**
 * Format a single record
 */
function formatRecord(company, countryCode, fetchId, source, fetchDate) {
  // Truncate all string fields to match VARCHAR limits in schema
  const companyName = company.company_name?.substring(0, 255) || 'Unknown';
  const registrySource = (source.name || 'Unknown').substring(0, 100);
  const sponsorType = (source.sponsorType || 'Worker').substring(0, 50);
  const fetchSource = source.url.substring(0, 50);  // VARCHAR(50) in schema
  
  return {
    company_name: companyName,
    country_code: countryCode,
    registry_source: registrySource,
    sponsor_type: sponsorType,
    is_active: true,
    sponsorship_status: 'active',
    deactivated_at: null,
    fetch_id: fetchId,
    fetch_source: fetchSource,
    fetch_date: fetchDate || new Date().toISOString().split('T')[0],
    last_seen_fetch_id: fetchId,
    last_verified_at: new Date().toISOString(),
    raw_data: company.raw_data || {}
  };
}

/**
 * Upsert a single batch
 */
async function upsertBatch(batch, fetchId) {
  // Double-check all fields are within limits
  const sanitizedBatch = batch.map(record => ({
    ...record,
    company_name: String(record.company_name || '').substring(0, 255),
    country_code: String(record.country_code || '').substring(0, 2),
    registry_source: String(record.registry_source || '').substring(0, 100),
    sponsor_type: String(record.sponsor_type || 'Worker').substring(0, 50),
    fetch_id: String(record.fetch_id || '').substring(0, 100),
    fetch_source: String(record.fetch_source || '').substring(0, 50),  // VARCHAR(50)
    last_seen_fetch_id: String(record.last_seen_fetch_id || '').substring(0, 100),
  }));

  const { data, error } = await supabase
    .from('visa_sponsor_registry')
    .upsert(sanitizedBatch, {
      onConflict: 'company_name,country_code',
      ignoreDuplicates: false
    })
    .select('id');

  if (error) {
    console.error(`Batch error details:`, JSON.stringify(sanitizedBatch[0], null, 2));
    throw new Error(`Batch upsert failed: ${error.message}`);
  }

  // Supabase doesn't easily distinguish insert vs update
  // For simplicity, assume all are upserts
  return {
    inserted: data?.length || 0,
    updated: 0
  };
}

/**
 * Deactivate companies not seen in current fetch
 * Uses last_seen_fetch_id for efficient indexed lookup
 */
async function deactivateMissingCompanies(countryCode, fetchId) {
  // Only deactivate rows that were previously seen (last_seen_fetch_id IS NOT NULL)
  // but are not in the current fetch
  const { error, count } = await supabase
    .from('visa_sponsor_registry')
    .update({
      is_active: false,
      sponsorship_status: 'inactive',
      deactivated_at: new Date().toISOString()
    })
    .eq('country_code', countryCode)
    .eq('is_active', true)
    .not('last_seen_fetch_id', 'is', null)
    .neq('last_seen_fetch_id', fetchId);

  if (error) {
    console.warn(`   ⚠️  Deactivation warning: ${error.message}`);
    return 0;
  }

  return count || 0;
}

/**
 * Fetch UK registry
 */
async function importUKRegistry() {
  console.log('📥 Downloading UK Home Office Sponsor List...');
  
  const source = REGISTRY_SOURCES.GB;
  const response = await fetch(source.url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const csvText = await response.text();
  const lines = csvText.split('\n').filter(line => line.trim());
  console.log(`   Downloaded ${lines.length.toLocaleString()} lines\n`);

  if (lines.length < 2) {
    throw new Error('CSV file is empty');
  }

  const header = parseCSVLine(lines[0]);
  const orgNameIdx = header.findIndex(h => 
    h.toLowerCase().includes('organisation') || 
    h.toLowerCase().includes('company')
  );
  const townIdx = header.findIndex(h => h.toLowerCase().includes('town'));
  const countyIdx = header.findIndex(h => h.toLowerCase().includes('county'));
  const routeIdx = header.findIndex(h => h.toLowerCase().includes('route'));

  const fetchDateMatch = source.url.match(/(\d{4}-\d{2}-\d{2})/);
  const fetchDate = fetchDateMatch ? fetchDateMatch[0] : new Date().toISOString().split('T')[0];

  const companies = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    if (row.length < header.length) continue;
    
    const orgName = row[orgNameIdx]?.trim();
    if (!orgName || orgName.length < 3) continue;

    companies.push({
      company_name: orgName,
      raw_data: {
        town: row[townIdx]?.trim() || '',
        county: row[countyIdx]?.trim() || '',
        route: (row[routeIdx]?.trim() || 'Worker').substring(0, 50)
      }
    });
  }

  console.log(`   Parsed ${companies.length.toLocaleString()} companies`);
  return { companies, fetchDate };
}

/**
 * Fetch Netherlands registry
 */
async function importNLRegistry() {
  console.log('📥 Downloading Netherlands IND Sponsor List...');
  
  const source = REGISTRY_SOURCES.NL;
  const response = await fetch(source.url, {
    headers: { 
      'User-Agent': 'JobScanAI/1.0 (visa-sponsor-research)',
      'Accept': 'text/html,application/xhtml+xml'
    }
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Find the first table with sponsor data
  const table = $('table').first();
  const rows = table.find('tbody > tr');
  
  console.log(`   Total rows found in table: ${rows.length}`);

  const companies = [];
  let skippedHeader = 0;
  let skippedInvalid = 0;

  // Process each row
  rows.each((i, el) => {
    const row = $(el);
    
    // Skip header row - it contains "Organisation" text
    const thText = row.find('th').text().trim();
    if (thText.toLowerCase().includes('organisation') || thText.length === 0) {
      skippedHeader++;
      return;
    }

    // Extract company name from <th> and KVK from <td>
    const companyName = thText;
    const kvkNumber = row.find('td').text().trim();

    // Validate
    if (companyName.length < 3 || companyName.length > 200) {
      skippedInvalid++;
      return;
    }

    companies.push({
      company_name: companyName,
      raw_data: {
        kvk_number: kvkNumber,
        source: 'IND_NL'
      }
    });
  });

  console.log(`   Valid companies extracted: ${companies.length}`);
  console.log(`   Skipped: ${skippedHeader} header rows, ${skippedInvalid} invalid rows`);

  return { 
    companies, 
    fetchDate: new Date().toISOString().split('T')[0] 
  };
}

/**
 * Parse CSV line handling quotes
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else { current += char; }
  }
  result.push(current.trim());
  return result.map(f => f.replace(/^"|"$/g, ''));
}

// Run if executed directly
if (process.argv[1]?.endsWith('import-visa-registries.js')) {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║   VISA SPONSOR REGISTRY IMPORTER (Batched)            ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');
  
  importRegistry()
    .then(result => {
      if (result.status === 'success') {
        process.exit(0);
      } else {
        console.error(`Failed: ${result.error}`);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Error:', error);
      process.exit(1);
    });
}