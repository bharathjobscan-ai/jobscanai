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
    const { country, min_score } = req.query;

    // Build query
    let query = supabase
      .from('job_normalized')
      .select('*')
      .order('relevance_score', { ascending: false });

    // Apply filters
    if (country) {
      query = query.ilike('location', `%${country}%`);
    }

    if (min_score) {
      const minScoreNum = parseInt(min_score, 10);
      if (!isNaN(minScoreNum)) {
        query = query.gte('relevance_score', minScoreNum);
      }
    }

    // Execute query
    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch jobs: ${error.message}`);
    }

    res.status(200).json({
      success: true,
      count: data.length,
      jobs: data
    });
  } catch (error) {
    console.error('Jobs fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch jobs',
      message: error.message
    });
  }
};
