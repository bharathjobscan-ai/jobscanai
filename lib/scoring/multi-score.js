/**
 * Enhanced Multi-Score Scoring Engine
 * Calculates 3 primary scores: Visa, Resume Match, Job Relevance
 * Then combines them into an Overall Score
 */

/**
 * Calculate all scores for a job against user profile
 * @param {Object} job - Normalized job data
 * @param {Object} profile - User profile with categorized skills
 * @param {Object} visaIntel - Visa intelligence data
 * @param {Object} config - Scoring configuration
 * @returns {Object} Complete score breakdown
 */
export function calculateMultiScore(job, profile, visaIntel = {}, config = {}) {
  // Default config weights
  const weights = {
    visa_score_weight: config.visa_score_weight || 0.40,
    resume_score_weight: config.resume_score_weight || 0.35,
    relevance_score_weight: config.relevance_score_weight || 0.25,
    domain_skills_weight: config.domain_skills_weight || 0.50,
    core_pm_skills_weight: config.core_pm_skills_weight || 0.30,
    tools_skills_weight: config.tools_skills_weight || 0.15,
    tech_skills_weight: config.tech_skills_weight || 0.05
  };

  // Calculate each primary score
  const visaScore = calculateVisaScore(job, visaIntel, profile);
  const resumeScore = calculateResumeMatchScore(job, profile, weights);
  const relevanceScore = calculateJobRelevanceScore(job, profile);

  // Calculate overall score as weighted combination
  const overallScore = Math.round(
    (visaScore.total * weights.visa_score_weight) +
    (resumeScore.total * weights.resume_score_weight) +
    (relevanceScore.total * weights.relevance_score_weight)
  );

  // Generate recommendation
  const recommendation = getRecommendation(overallScore, visaScore.total, resumeScore.total);

  return {
    overall_score: Math.min(100, Math.max(0, overallScore)),
    visa_score: visaScore.total,
    resume_match_score: resumeScore.total,
    job_relevance_score: relevanceScore.total,
    recommendation,
    breakdown: {
      visa: visaScore,
      resume: resumeScore,
      relevance: relevanceScore,
      weights
    }
  };
}

/**
 * Calculate Visa Sponsorship Score (0-100)
 */
function calculateVisaScore(job, visaIntel, profile) {
  let score = 0;
  const breakdown = {};

  // 1. Official Registry Match (40 points)
  if (visaIntel.registry_match) {
    score += 40;
    breakdown.registry_match = { score: 40, status: 'confirmed' };
  } else {
    breakdown.registry_match = { score: 0, status: 'not_found' };
  }

  // 2. Recent Sponsorship Activity (20 points)
  if (visaIntel.recent_activity) {
    const activityScore = Math.min(20, visaIntel.recent_activity_count * 5);
    score += activityScore;
    breakdown.recent_activity = { 
      score: activityScore, 
      count: visaIntel.recent_activity_count,
      status: 'active'
    };
  } else {
    breakdown.recent_activity = { score: 0, status: 'unknown' };
  }

  // 3. Community Intelligence (20 points)
  if (visaIntel.community_signals) {
    const communityScore = Math.min(20, visaIntel.community_signals.positive_count * 2);
    score += communityScore;
    breakdown.community_signals = {
      score: communityScore,
      positive: visaIntel.community_signals.positive_count,
      negative: visaIntel.community_signals.negative_count
    };
  } else {
    breakdown.community_signals = { score: 0, status: 'no_data' };
  }

  // 4. JD Keywords (10 points)
  if (visaIntel.jd_keywords_found) {
    score += 10;
    breakdown.jd_keywords = { score: 10, status: 'explicit_mention' };
  } else {
    breakdown.jd_keywords = { score: 0, status: 'not_mentioned' };
  }

  // 5. Salary Threshold Check (10 points)
  const salaryCheck = checkSalaryThreshold(job, profile);
  if (salaryCheck.meets_threshold) {
    score += 10;
    breakdown.salary_threshold = { score: 10, status: 'above_minimum' };
  } else if (salaryCheck.close_to_threshold) {
    score += 5;
    breakdown.salary_threshold = { score: 5, status: 'close_to_minimum' };
  } else {
    breakdown.salary_threshold = { score: 0, status: 'below_minimum' };
  }

  // Penalties
  let penalties = 0;
  if (visaIntel.explicit_no_sponsorship) {
    penalties += 30;
    breakdown.penalties = breakdown.penalties || [];
    breakdown.penalties.push({ reason: 'explicit_no_sponsorship', points: -30 });
  }

  score = Math.max(0, score - penalties);

  return {
    total: Math.min(100, score),
    breakdown,
    rating: getRating(score)
  };
}

/**
 * Calculate Resume Match Score (0-100) with skill categorization
 */
function calculateResumeMatchScore(job, profile, weights) {
  let score = 0;
  const breakdown = {};

  // Extract job skills (assuming normalized format)
  const jobSkills = (job.skills || []).map(s => s.toLowerCase());
  const jobDomains = (job.domains || []).map(d => d.toLowerCase());

  // 1. Domain Match (50 points) - HIGHEST WEIGHT
  const domainSkills = (profile.skills_must_have_domain || []).map(s => s.toLowerCase());
  const domainMatch = calculateSkillMatch(domainSkills, [...jobSkills, ...jobDomains]);
  const domainScore = Math.round(50 * weights.domain_skills_weight * 2 * (domainMatch / 100));
  score += domainScore;
  breakdown.domain_match = {
    score: domainScore,
    max: 50,
    match_percentage: domainMatch,
    matched_skills: getMatchedSkills(domainSkills, [...jobSkills, ...jobDomains])
  };

  // 2. Core PM Skills (30 points)
  const corePMSkills = (profile.skills_must_have_core_pm || []).map(s => s.toLowerCase());
  const pmMatch = calculateSkillMatch(corePMSkills, jobSkills);
  const pmScore = Math.round(30 * weights.core_pm_skills_weight * 2 * (pmMatch / 100));
  score += pmScore;
  breakdown.core_pm_match = {
    score: pmScore,
    max: 30,
    match_percentage: pmMatch,
    matched_skills: getMatchedSkills(corePMSkills, jobSkills)
  };

  // 3. PM Tools (15 points)
  const toolsSkills = (profile.skills_good_to_have || []).map(s => s.toLowerCase());
  const toolsMatch = calculateSkillMatch(toolsSkills, jobSkills);
  const toolsScore = Math.round(15 * weights.tools_skills_weight * 2 * (toolsMatch / 100));
  score += toolsScore;
  breakdown.tools_match = {
    score: toolsScore,
    max: 15,
    match_percentage: toolsMatch,
    matched_skills: getMatchedSkills(toolsSkills, jobSkills)
  };

  // 4. Technical/Nice-to-Have (5 points)
  const techSkills = (profile.skills_okay_to_have || []).map(s => s.toLowerCase());
  const techMatch = calculateSkillMatch(techSkills, jobSkills);
  const techScore = Math.round(5 * weights.tech_skills_weight * 2 * (techMatch / 100));
  score += techScore;
  breakdown.technical_match = {
    score: techScore,
    max: 5,
    match_percentage: techMatch,
    matched_skills: getMatchedSkills(techSkills, jobSkills)
  };

  return {
    total: Math.min(100, score),
    breakdown,
    rating: getRating(score)
  };
}

/**
 * Calculate Job Relevance Score (0-100)
 */
function calculateJobRelevanceScore(job, profile) {
  let score = 0;
  const breakdown = {};

  // 1. Location Match (25 points)
  const locationScore = calculateLocationMatch(job, profile);
  score += locationScore.score;
  breakdown.location = locationScore;

  // 2. Salary Match (25 points)
  const salaryScore = calculateSalaryMatch(job, profile);
  score += salaryScore.score;
  breakdown.salary = salaryScore;

  // 3. Role/Seniority Match (25 points)
  const roleScore = calculateRoleMatch(job, profile);
  score += roleScore.score;
  breakdown.role = roleScore;

  // 4. Experience Level (15 points)
  const experienceScore = calculateExperienceMatch(job, profile);
  score += experienceScore.score;
  breakdown.experience = experienceScore;

  // 5. Industry/Company (10 points)
  const industryScore = calculateIndustryMatch(job, profile);
  score += industryScore.score;
  breakdown.industry = industryScore;

  return {
    total: Math.min(100, score),
    breakdown,
    rating: getRating(score)
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateSkillMatch(userSkills, jobSkills) {
  if (!userSkills || userSkills.length === 0) return 0;
  
  const matched = userSkills.filter(us => 
    jobSkills.some(js => js.includes(us) || us.includes(js))
  );
  
  return Math.round((matched.length / userSkills.length) * 100);
}

function getMatchedSkills(userSkills, jobSkills) {
  return userSkills.filter(us => 
    jobSkills.some(js => js.includes(us) || us.includes(js))
  );
}

function calculateLocationMatch(job, profile) {
  const jobLocation = (job.location || '').toLowerCase();
  const jobCountry = (job.country_code || '').toUpperCase();
  
  const preferredLocations = (profile.preferred_locations || []).map(l => l.toLowerCase());
  const targetCountries = (profile.target_countries || []).map(c => c.toUpperCase());
  
  // Perfect match: city in preferred list
  if (preferredLocations.some(loc => jobLocation.includes(loc))) {
    return { score: 25, match_type: 'preferred_city', location: jobLocation };
  }
  
  // Good match: country in target list
  if (targetCountries.includes(jobCountry)) {
    return { score: 20, match_type: 'target_country', country: jobCountry };
  }
  
  // Remote jobs get partial score
  if (job.is_remote) {
    return { score: 15, match_type: 'remote', location: 'remote' };
  }
  
  return { score: 0, match_type: 'no_match', location: jobLocation };
}

function calculateSalaryMatch(job, profile) {
  const expectation = profile.salary_expectation || {};
  if (!expectation.min || !job.salary_min) {
    return { score: 12, match_type: 'unknown', note: 'Salary data incomplete' };
  }
  
  // Normalize to GBP for comparison
  const jobSalaryGBP = normalizeSalaryToGBP(job.salary_min, job.salary_currency);
  const minExpected = expectation.min;
  const maxExpected = expectation.max;
  
  // Perfect match: within range
  if (jobSalaryGBP >= minExpected && jobSalaryGBP <= maxExpected) {
    return { 
      score: 25, 
      match_type: 'in_range', 
      job_salary: jobSalaryGBP,
      expected_range: `${minExpected}-${maxExpected} GBP`
    };
  }
  
  // Above range (even better!)
  if (jobSalaryGBP > maxExpected) {
    return { 
      score: 25, 
      match_type: 'above_range', 
      job_salary: jobSalaryGBP,
      expected_range: `${minExpected}-${maxExpected} GBP`
    };
  }
  
  // Slightly below minimum (within 10%)
  if (jobSalaryGBP >= minExpected * 0.9) {
    return { 
      score: 15, 
      match_type: 'slightly_below', 
      job_salary: jobSalaryGBP,
      expected_range: `${minExpected}-${maxExpected} GBP`
    };
  }
  
  return { 
    score: 0, 
    match_type: 'below_minimum', 
    job_salary: jobSalaryGBP,
    expected_range: `${minExpected}-${maxExpected} GBP`
  };
}

function calculateRoleMatch(job, profile) {
  const jobTitle = (job.title || '').toLowerCase();
  const flexibility = profile.role_flexibility || { preferred: [], acceptable: [] };
  
  const preferredRoles = (flexibility.preferred || []).map(r => r.toLowerCase());
  const acceptableRoles = (flexibility.acceptable || []).map(r => r.toLowerCase());
  
  // Check preferred roles
  if (preferredRoles.some(role => jobTitle.includes(role) || role.includes(jobTitle))) {
    return { score: 25, match_type: 'preferred', role: jobTitle };
  }
  
  // Check acceptable roles
  if (acceptableRoles.some(role => jobTitle.includes(role) || role.includes(jobTitle))) {
    return { score: 20, match_type: 'acceptable', role: jobTitle };
  }
  
  // Partial match on keywords
  const roleKeywords = ['product', 'manager', 'pm', 'lead'];
  if (roleKeywords.some(kw => jobTitle.includes(kw))) {
    return { score: 10, match_type: 'partial', role: jobTitle };
  }
  
  return { score: 0, match_type: 'no_match', role: jobTitle };
}

function calculateExperienceMatch(job, profile) {
  const userExp = profile.years_of_experience || 0;
  const jobExpMin = job.experience_min || 0;
  const jobExpMax = job.experience_max || 99;
  
  // Perfect match: within range
  if (userExp >= jobExpMin && userExp <= jobExpMax) {
    return { 
      score: 15, 
      match_type: 'perfect', 
      user_exp: userExp,
      job_range: `${jobExpMin}-${jobExpMax}`
    };
  }
  
  // Slightly overqualified (1-2 years)
  if (userExp > jobExpMax && userExp <= jobExpMax + 2) {
    return { 
      score: 12, 
      match_type: 'slightly_over', 
      user_exp: userExp,
      job_range: `${jobExpMin}-${jobExpMax}`
    };
  }
  
  // Slightly underqualified (1-2 years)
  if (userExp < jobExpMin && userExp >= jobExpMin - 2) {
    return { 
      score: 10, 
      match_type: 'slightly_under', 
      user_exp: userExp,
      job_range: `${jobExpMin}-${jobExpMax}`
    };
  }
  
  return { 
    score: 0, 
    match_type: 'mismatch', 
    user_exp: userExp,
    job_range: `${jobExpMin}-${jobExpMax}`
  };
}

function calculateIndustryMatch(job, profile) {
  const jobDomains = (job.domains || []).map(d => d.toLowerCase());
  const userIndustries = (profile.industries || []).map(i => i.toLowerCase());
  
  if (userIndustries.some(ind => jobDomains.includes(ind))) {
    return { score: 10, match_type: 'perfect', industries: jobDomains };
  }
  
  // Partial match on common keywords
  const commonIndustries = ['fintech', 'finance', 'banking', 'payments', 'tech'];
  if (commonIndustries.some(ci => jobDomains.includes(ci) && userIndustries.includes(ci))) {
    return { score: 7, match_type: 'related', industries: jobDomains };
  }
  
  return { score: 3, match_type: 'neutral', industries: jobDomains };
}

function checkSalaryThreshold(job, profile) {
  // Simplified - would query visa_salary_thresholds table in real implementation
  const countryThresholds = {
    'GB': 38700,
    'NL': 45000,
    'DE': 45300,
    'SE': 156000, // SEK
    'AU': 70000,
    'CA': 54000
  };
  
  const threshold = countryThresholds[job.country_code];
  if (!threshold || !job.salary_min) {
    return { meets_threshold: false, close_to_threshold: false };
  }
  
  const jobSalaryGBP = normalizeSalaryToGBP(job.salary_min, job.salary_currency);
  const thresholdGBP = normalizeSalaryToGBP(threshold, job.country_code === 'SE' ? 'SEK' : 'GBP');
  
  if (jobSalaryGBP >= thresholdGBP) {
    return { meets_threshold: true, close_to_threshold: false };
  }
  
  if (jobSalaryGBP >= thresholdGBP * 0.9) {
    return { meets_threshold: false, close_to_threshold: true };
  }
  
  return { meets_threshold: false, close_to_threshold: false };
}

function normalizeSalaryToGBP(amount, currency) {
  const rates = {
    'GBP': 1,
    'USD': 0.79,
    'EUR': 0.85,
    'AUD': 0.52,
    'CAD': 0.58,
    'SEK': 0.074,
    'AED': 0.21
  };
  
  return amount * (rates[currency] || 1);
}

function getRating(score) {
  if (score >= 90) return '⭐⭐⭐⭐⭐ EXCELLENT';
  if (score >= 80) return '⭐⭐⭐⭐ STRONG';
  if (score >= 70) return '⭐⭐⭐ GOOD';
  if (score >= 60) return '⭐⭐ FAIR';
  if (score >= 50) return '⭐ WEAK';
  return '❌ POOR';
}

function getRecommendation(overallScore, visaScore, resumeScore) {
  if (overallScore >= 85 && visaScore >= 80) {
    return {
      action: 'APPLY NOW',
      priority: 'HIGH',
      confidence: 'Very High',
      reason: 'Strong visa sponsorship likelihood and excellent profile match'
    };
  }
  
  if (overallScore >= 75 && visaScore >= 60) {
    return {
      action: 'STRONGLY CONSIDER',
      priority: 'HIGH',
      confidence: 'High',
      reason: 'Good visa chances and solid profile fit'
    };
  }
  
  if (overallScore >= 65) {
    return {
      action: 'CONSIDER',
      priority: 'MEDIUM',
      confidence: 'Moderate',
      reason: 'Decent match but verify visa sponsorship availability'
    };
  }
  
  if (overallScore >= 50) {
    return {
      action: 'REVIEW CAREFULLY',
      priority: 'LOW',
      confidence: 'Low',
      reason: 'Marginal fit - apply only if few better options'
    };
  }
  
  return {
    action: 'SKIP',
    priority: 'VERY LOW',
    confidence: 'Very Low',
    reason: 'Poor match on multiple factors'
  };
}
