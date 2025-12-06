const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
const { normalizeHtml } = require('../../lib/normalizers/basic');
const { computeVisaFromNormalized } = require('../../lib/visa_intel/basic');
const { computeScore } = require('../../lib/scoring/simple');

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
    const normalized = normalizeHtml(html, url);

    // Get company registry for visa scoring
    const { data: companyRegistry } = await supabase
      .from('company_registry')
      .select('*');

    // Compute visa score
    const visaResult = computeVisaFromNormalized(normalized, companyRegistry || []);

    // Compute overall score
    const resumeBaseline = resume_baseline || {};
    const score = computeScore(normalized, resumeBaseline, visaResult.visa_score_int);

    // Store normalized job
    const { data: normalizedJob, error: normalizedError } = await supabase
      .from('job_normalized')
      .insert({
        job_raw_id: rawJob.id,
        source_url: url,
        title: normalized.title,
        company: normalized.company,
        location: normalized.location,
        normalized_text: normalized.normalized_text,
        skill_tags: normalized.skill_tags,
        domain_tags: normalized.domain_tags,
        visa_confidence: visaResult.visa_confidence,
        visa_score_int: visaResult.visa_score_int,
        visa_categories: visaResult.visa_categories,
        visa_explanation: visaResult.explanation,
        relevance_score: score,
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
      visa_score: visaResult.visa_score_int,
      relevance_score: score
    });
  } catch (error) {
    console.error('Ingestion error:', error);
    res.status(500).json({
      error: 'Failed to ingest job',
      message: error.message
    });
  }
};
