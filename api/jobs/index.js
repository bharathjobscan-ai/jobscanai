const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );

    // Get query parameters
    const { 
      country, 
      min_score,
      min_overall_score,
      min_visa_score,
      min_resume_score,
      min_relevance_score,
      sort_by = 'overall_score',
      limit = 50
    } = req.query;

    // Build query - default sort by overall_score
    let query = supabase
      .from('job_normalized')
      .select('*')
      .order(sort_by, { ascending: false })
      .limit(parseInt(limit, 10) || 50);

    // Apply filters
    if (country) {
      query = query.ilike('location', `%${country}%`);
    }

    // Multi-score filters (Phase 1.5)
    if (min_overall_score) {
      const score = parseInt(min_overall_score, 10);
      if (!isNaN(score)) {
        query = query.gte('overall_score', score);
      }
    }

    if (min_visa_score) {
      const score = parseInt(min_visa_score, 10);
      if (!isNaN(score)) {
        query = query.gte('visa_score', score);
      }
    }

    if (min_resume_score) {
      const score = parseInt(min_resume_score, 10);
      if (!isNaN(score)) {
        query = query.gte('resume_match_score', score);
      }
    }

    if (min_relevance_score) {
      const score = parseInt(min_relevance_score, 10);
      if (!isNaN(score)) {
        query = query.gte('job_relevance_score', score);
      }
    }

    // Legacy filter support
    if (min_score && !min_overall_score) {
      const score = parseInt(min_score, 10);
      if (!isNaN(score)) {
        query = query.gte('overall_score', score);
      }
    }

    // Execute query
    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch jobs: ${error.message}`);
    }

    // Format response with multi-score data
    const jobs = data.map(job => ({
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      country_code: job.country_code,
      source_url: job.source_url,
      
      // Salary info
      salary: {
        raw: job.salary_raw,
        min: job.salary_min,
        max: job.salary_max,
        currency: job.salary_currency
      },
      
      // Multi-Score System (Phase 1.5)
      scores: {
        overall: job.overall_score,
        visa: job.visa_score,
        resume_match: job.resume_match_score,
        job_relevance: job.job_relevance_score,
        breakdown: job.score_breakdown
      },
      
      // Recommendation
      recommendation: job.recommendation,
      
      // Tags
      skills: job.skill_tags,
      domains: job.domain_tags,
      
      // Job details
      is_remote: job.is_remote,
      created_at: job.created_at
    }));

    res.status(200).json({
      success: true,
      count: jobs.length,
      filters_applied: {
        country: country || null,
        min_overall_score: min_overall_score || min_score || null,
        min_visa_score: min_visa_score || null,
        min_resume_score: min_resume_score || null,
        min_relevance_score: min_relevance_score || null,
        sort_by,
        limit: parseInt(limit, 10) || 50
      },
      jobs
    });
  } catch (error) {
    console.error('Jobs fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch jobs',
      message: error.message
    });
  }
};
