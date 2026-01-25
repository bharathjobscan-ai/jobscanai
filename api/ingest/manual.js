const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
const { normalizeJobHTML } = require('../../lib/normalizers/enhanced');
const { analyzeVisaSponsorship } = require('../../lib/visa_intel/enhanced');
const { calculateMultiScore } = require('../../lib/scoring/multi-score');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url, resume_baseline } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );

    // Fetch the URL
    const response = await fetch(url);
    const html = await response.text();

    // Store raw job
    const { data: rawJob, error: rawError } = await supabase
      .from('job_raw')
      .insert({
        source_url: url,
        raw_html: html,
        fetched_at: new Date().toISOString(),
        source_type: 'manual'
      })
      .select()
      .single();

    if (rawError) {
      throw new Error(`Failed to store raw job: ${rawError.message}`);
    }

    // Normalize the HTML
    const normalized = normalizeJobHTML(html, url);

    // Get user profile for scoring
    const { data: profileData } = await supabase
      .from('user_profile')
      .select('*')
      .limit(1)
      .single();

    // Compute visa score
    const visaResult = await analyzeVisaSponsorship(
      normalized.company,
      normalized.location,
      normalized.normalized_text,
      normalized.salary
    );

    // Compute overall score using multi-score system
    const resumeBaseline = resume_baseline || {};
    const profile = profileData || {};
    const multiScore = calculateMultiScore(normalized, profile, visaResult);

    // Store normalized job
    const { data: normalizedJob, error: normalizedError } = await supabase
      .from('job_normalized')
      .insert({
        job_raw_id: rawJob.id,
        source_url: url,
        title: normalized.title,
        company: normalized.company,
        location: normalized.location,
        country_code: normalized.country_code,
        normalized_text: normalized.normalized_text,
        skill_tags: normalized.skills,
        domain_tags: normalized.domains,
        is_remote: normalized.is_remote,
        salary_min: normalized.salary?.min,
        salary_max: normalized.salary?.max,
        salary_currency: normalized.salary?.currency,
        visa_score_int: visaResult.score,
        visa_confidence: visaResult.confidence,
        visa_categories: visaResult.categories,
        visa_explanation: visaResult.explanation,
        overall_score: multiScore.overall_score,
        visa_score: multiScore.visa_score,
        resume_match_score: multiScore.resume_match_score,
        job_relevance_score: multiScore.job_relevance_score,
        recommendation: multiScore.recommendation?.action,
        ingested_at: new Date().toISOString()
      })
      .select()
      .single();

    if (normalizedError) {
      throw new Error(`Failed to store normalized job: ${normalizedError.message}`);
    }

    // Log ingestion
    await supabase
      .from('ingestion_log')
      .insert({
        source_url: url,
        job_raw_id: rawJob.id,
        job_normalized_id: normalizedJob.id,
        status: 'success',
        created_at: new Date().toISOString()
      });

    res.status(200).json({
      success: true,
      job_normalized_id: normalizedJob.id,
      title: normalized.title,
      company: normalized.company,
      overall_score: multiScore.overall_score,
      visa_score: visaResult.score,
      recommendation: multiScore.recommendation
    });
  } catch (error) {
    console.error('Ingestion error:', error);
    res.status(500).json({
      error: 'Failed to ingest job',
      message: error.message
    });
  }
};
