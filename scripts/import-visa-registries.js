// Government Visa Sponsor Registry Data Importers
// Fetches official sponsor lists from government sources
// Priority: UK -> NL -> DE -> SE -> AU -> CA

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Registry URLs (as of 2024)
const REGISTRY_SOURCES = {
  UK: {
    url: 'https://assets.publishing.service.gov.uk/media/65bb6a88d7e51c000d8d0571/2024-01-31_-_Worker_and_Temporary_Worker.csv',
    type: 'csv',
    name: 'UK Home Office Skilled Worker Sponsor List'
  },
  NL: {
    url: 'https://ind.nl/en/public-register-recognised-sponsors',
    type: 'html', 
    name: 'Netherlands IND Recognised Sponsors'
  },
  DE: {
    url: 'https://www.bamf.de/EN/Themen/MigrationAufenthalt/ZuwandererDrittstaaten/Arbeit/Fachkraefte/fachkraefte-node.html',
    type: 'manual', // Germany doesn't have a public registry
    name: 'Germany Blue Card Information'
  },
  SE: {
    url: 'https://www.migrationsverket.se/English/Private-individuals/Working-in-Sweden.html',
    type: 'manual', // Sweden doesn't maintain a public employer list
    name: 'Sweden Migration Agency'
  },
  AU: {
    url: 'https://www.homeaffairs.gov.au/research-and-statistics/statistics/employer-and-migration-sponsor-statistics',
    type: 'manual', // Australia publishes quarterly PDFs
    name: 'Australian Home Affairs Sponsor Statistics'
  },
  CA: {
    url: 'https://www.canada.ca/en/employment-social-development/services/foreign-workers.html',
    type: 'manual', // Canada doesn't publish a complete list
    name: 'Canada LMIA Information'
  }
};

export async function importAllRegistries() {
  console.log('Starting visa registry import for all countries...\n');
  
  const results = {
    UK: await importUKRegistry(),
    NL: await importNLRegistry(),
    DE: { status: 'manual', message: 'Germany does not maintain a public registry' },
    SE: { status: 'manual', message: 'Sweden does not maintain a public registry' },
    AU: { status: 'manual', message: 'Australia data requires PDF parsing' },
    CA: { status: 'manual', message: 'Canada does not publish complete LMIA list' }
  };
  
  console.log('\n=== IMPORT SUMMARY ===');
  for (const [country, result] of Object.entries(results)) {
    console.log(`${country}: ${result.status} - ${result.imported || 0} companies`);
  }
  
  return results;
}

async function importUKRegistry() {
  console.log('Importing UK Home Office Sponsor List...');
  
  try {
    const response = await fetch(REGISTRY_SOURCES.UK.url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const csvText = await response.text();
    const lines = csvText.split('\n');
    
    // Skip header row
    const dataLines = lines.slice(1).filter(line => line.trim());
    
    const companies = [];
    for (const line of dataLines) {
      // CSV format: Organisation Name, Town/City, County, Type & Rating, Route
      const parts = parseCSVLine(line);
      
      if (parts.length >= 3) {
        const companyName = parts[0]?.trim();
        const location = `${parts[1]?.trim()}, ${parts[2]?.trim()}`;
        const sponsorType = parts[3]?.trim() || 'Skilled Worker';
        
        if (companyName) {
          companies.push({
            company_name: companyName,
            country_code: 'GB',
            registry_source: 'UK Home Office',
            sponsor_type: sponsorType,
            is_active: true,
            last_verified_at: new Date().toISOString(),
            raw_data: {
              location,
              original_line: line
            }
          });
        }
      }
    }
    
    // Bulk insert to database
    let imported = 0;
    const batchSize = 100;
    
    for (let i = 0; i < companies.length; i += batchSize) {
      const batch = companies.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('visa_sponsor_registry')
        .upsert(batch, {
          onConflict: 'company_name,country_code',
          ignoreDuplicates: false
        });
      
      if (error) {
        console.error(`Batch ${i / batchSize} error:`, error);
      } else {
        imported += batch.length;
      }
    }
    
    console.log(`✅ UK: Imported ${imported} companies`);
    return { status: 'success', imported };
    
  } catch (error) {
    console.error('UK import failed:', error);
    return { status: 'failed', error: error.message };
  }
}

async function importNLRegistry() {
  console.log('Importing Netherlands IND Recognised Sponsors...');
  
  try {
    const response = await fetch(REGISTRY_SOURCES.NL.url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const companies = [];
    
    // The IND website structure may vary, this is a general scraper
    // Look for tables or lists containing company names
    $('table tbody tr, .company-list li').each((i, el) => {
      const text = $(el).text().trim();
      
      // Extract company name (heuristic)
      const companyMatch = text.match(/^([A-Z][A-Za-z0-9\s&.,-]{3,100})/);
      
      if (companyMatch) {
        companies.push({
          company_name: companyMatch[1].trim(),
          country_code: 'NL',
          registry_source: 'Netherlands IND',
          sponsor_type: 'Highly Skilled Migrant',
          is_active: true,
          last_verified_at: new Date().toISOString(),
          raw_data: {
            original_text: text
          }
        });
      }
    });
    
    if (companies.length === 0) {
      console.log('⚠️  NL: No companies found - website structure may have changed');
      return { 
        status: 'warning', 
        message: 'No companies parsed - manual verification needed',
        imported: 0
      };
    }
    
    // Bulk insert
    let imported = 0;
    const batchSize = 100;
    
    for (let i = 0; i < companies.length; i += batchSize) {
      const batch = companies.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('visa_sponsor_registry')
        .upsert(batch, {
          onConflict: 'company_name,country_code',
          ignoreDuplicates: false
        });
      
      if (error) {
        console.error(`Batch error:`, error);
      } else {
        imported += batch.length;
      }
    }
    
    console.log(`✅ NL: Imported ${imported} companies`);
    return { status: 'success', imported };
    
  } catch (error) {
    console.error('NL import failed:', error);
    return { status: 'failed', error: error.message };
  }
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

// If run directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  importAllRegistries()
    .then(results => {
      console.log('\n✅ Import completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Import failed:', error);
      process.exit(1);
    });
}
