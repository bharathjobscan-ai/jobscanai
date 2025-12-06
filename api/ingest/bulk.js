// Bulk URL Import API Endpoint
// Supports CSV upload or JSON array of URLs

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { urls, source_type = 'bulk_manual' } = req.body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid input', 
        message: 'urls must be a non-empty array' 
      });
    }

    // Create bulk import job
    const { data: importJob, error: jobError } = await supabase
      .from('bulk_import_jobs')
      .insert({
        import_type: source_type,
        total_urls: urls.length,
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (jobError) {
      throw new Error(`Failed to create import job: ${jobError.message}`);
    }

    // Process URLs in batches
    const batchSize = 5;
    const results = {
      successful: [],
      failed: [],
      errors: []
    };

    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      
      await Promise.allSettled(
        batch.map(async (url) => {
          try {
            // Validate URL
            const urlObj = new URL(url);
            
            // Check if already exists
            const { data: existing } = await supabase
              .from('job_raw')
              .select('id, source_url')
              .eq('source_url', url)
              .single();

            if (existing) {
              results.failed.push(url);
              results.errors.push({
                url,
                error: 'Duplicate URL - already exists in database'
              });
              return;
            }

            // Fetch the URL content
            const response = await fetch(url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; JobScanAI/1.0)',
              },
              timeout: 10000
            });

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const html = await response.text();

            // Store raw HTML
            const { data: jobRaw, error: rawError } = await supabase
              .from('job_raw')
              .insert({
                source_url: url,
                raw_html: html,
                source_type,
                fetched_at: new Date().toISOString()
              })
              .select()
              .single();

            if (rawError) {
              throw new Error(`Failed to store: ${rawError.message}`);
            }

            results.successful.push(url);

            // Trigger processing in background (fire and forget)
            processJobInBackground(jobRaw.id, url, html).catch(err => {
              console.error(`Background processing failed for ${url}:`, err);
            });

          } catch (error) {
            results.failed.push(url);
            results.errors.push({
              url,
              error: error.message
            });
          }
        })
      );

      // Update progress
      await supabase
        .from('bulk_import_jobs')
        .update({
          processed_urls: Math.min(i + batchSize, urls.length),
          successful_urls: results.successful.length,
          failed_urls: results.failed.length
        })
        .eq('id', importJob.id);
    }

    // Finalize import job
    await supabase
      .from('bulk_import_jobs')
      .update({
        status: 'completed',
        successful_urls: results.successful.length,
        failed_urls: results.failed.length,
        error_log: results.errors,
        completed_at: new Date().toISOString()
      })
      .eq('id', importJob.id);

    return res.status(200).json({
      message: 'Bulk import completed',
      import_job_id: importJob.id,
      total: urls.length,
      successful: results.successful.length,
      failed: results.failed.length,
      errors: results.errors
    });

  } catch (error) {
    console.error('Bulk import error:', error);
    return res.status(500).json({ 
      error: 'Bulk import failed', 
      message: error.message 
    });
  }
}

// Background processing function
async function processJobInBackground(jobRawId, url, html) {
  try {
    // Import processing modules
    const normalizer = await import('../../lib/normalizers/enhanced.js');
    const visaIntel = await import('../../lib/visa_intel/enhanced.js');
    const scorer = await import('../../lib/scoring/enhanced.js');

    // Normalize the HTML
    const normalized = normalizer.normalizeJobHTML(html, url);

    // Get visa intelligence
    const visaData = await visaIntel.analyzeVisaSponsorship(
      normalized.company,
      normalized.location,
      normalized.normalized_text,
      normalized.salary
    );

    // Get user profile for scoring
    const { data: profile } = await supabase
      .from('user_profile')
      .select('*')
      .limit(1)
      .single();

    // Calculate score
    const scoring = await scorer.calculateEnhancedScore(
      normalized,
      visaData,
      profile
    );

    // Store normalized job
    await supabase
      .from('job_normalized')
      .insert({
        job_raw_id: jobRawId,
        source_url: url,
        title: normalized.title,
        company: normalized.company,
        location: normalized.location,
        normalized_text: normalized.normalized_text,
        skill_tags: normalized.skills,
        domain_tags: normalized.domains,
        country_code: normalized.country_code,
        salary_raw: normalized.salary?.raw,
        salary_min: normalized.salary?.min,
        salary_max: normalized.salary?.max,
        salary_currency: normalized.salary?.currency,
        is_remote: normalized.is_remote,
        recruiter_email: normalized.recruiter_email,
        recruiter_type: normalized.recruiter_type,
        
        // Visa scoring
        visa_confidence: visaData.confidence,
        visa_score_int: visaData.score,
        visa_categories: visaData.categories,
        visa_explanation: visaData.explanation,
        visa_registry_match: visaData.registry_match,
        visa_recent_activity: visaData.recent_activity_score,
        visa_community_score: visaData.community_score,
        visa_jd_keywords_score: visaData.jd_keywords_score,
        
        // Relevance scoring
        relevance_skills_score: scoring.relevance.skills_score,
        relevance_experience_score: scoring.relevance.experience_score,
        
        // Realism scoring
        realism_hiring_score: scoring.realism.hiring_score,
        realism_seniority_score: scoring.realism.seniority_score,
        realism_location_score: scoring.realism.location_score,
        
        // Strategic scoring
        strategic_salary_score: scoring.strategic.salary_score,
        strategic_industry_score: scoring.strategic.industry_score,
        strategic_growth_score: scoring.strategic.growth_score,
        
        // Overall
        total_score: scoring.total_score,
        score_breakdown: scoring.breakdown,
        recommendation: scoring.recommendation,
        relevance_score: scoring.total_score
      });

    console.log(`Successfully processed job: ${url}`);
  } catch (error) {
    console.error(`Failed to process job ${url}:`, error);
    
    // Log the error
    await supabase
      .from('ingestion_log')
      .insert({
        source_url: url,
        job_raw_id: jobRawId,
        status: 'failed',
        error_message: error.message
      });
  }
}
