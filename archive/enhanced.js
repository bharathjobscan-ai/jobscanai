// Enhanced Job Scoring Engine
// Configurable multi-component scoring system

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export async function calculateEnhancedScore(normalized, visaData, userProfile) {
  // Get scoring configuration
  const config = await getScoringConfig();
  
  // Calculate component scores
  const visaScore = calculateVisaScore(visaData, config);
  const relevanceScore = calculateRelevanceScore(normalized, userProfile, config);
  const realismScore = calculateRealismScore(normalized, userProfile, config);
  const strategicScore = calculateStrategicScore(normalized, visaData, config);
  
  // Calculate weighted total
  const totalScore = Math.round(
    (visaScore.total * config.visa_weight / 100) +
    (relevanceScore.total * config.relevance_weight / 100) +
    (realismScore.total * config.realism_weight / 100) +
    (strategicScore.total * config.strategic_weight / 100)
  );
  
  // Generate recommendation
  const recommendation = generateRecommendation(totalScore, visaScore, config);
  
  // Build detailed breakdown
  const breakdown = {
    visa: {
      score: visaScore.total,
      weight: config.visa_weight,
      weighted: Math.round(visaScore.total * config.visa_weight / 100),
      components: visaScore.components
    },
    relevance: {
      score: relevanceScore.total,
      weight: config.relevance_weight,
      weighted: Math.round(relevanceScore.total * config.relevance_weight / 100),
      components: relevanceScore.components
    },
    realism: {
      score: realismScore.total,
      weight: config.realism_weight,
      weighted: Math.round(realismScore.total * config.realism_weight / 100),
      components: realismScore.components
    },
    strategic: {
      score: strategicScore.total,
      weight: config.strategic_weight,
      weighted: Math.round(strategicScore.total * config.strategic_weight / 100),
      components: strategicScore.components
    }
  };
  
  return {
    total_score: totalScore,
    recommendation,
    breakdown,
    
    // Individual component scores for database storage
    relevance: {
      skills_score: relevanceScore.components.skills,
      experience_score: relevanceScore.components.experience
    },
    realism: {
      hiring_score: realismScore.components.hiring_trends,
      seniority_score: realismScore.components.seniority_match,
      location_score: realismScore.components.location
    },
    strategic: {
      salary_score: strategicScore.components.salary,
      industry_score: strategicScore.components.industry,
      growth_score: strategicScore.components.growth
    }
  };
}

async function getScoringConfig() {
  try {
    const { data, error } = await supabase
      .from('scoring_config')
      .select('*')
      .eq('is_active', true)
      .single();
    
    if (error || !data) {
      // Return default config
      return {
        visa_weight: 50,
        relevance_weight: 25,
        realism_weight: 15,
        strategic_weight: 10,
        visa_registry_points: 20,
        visa_recent_activity_points: 15,
        visa_community_signals_points: 10,
        visa_jd_keywords_points: 5,
        relevance_skills_points: 15,
        relevance_experience_points: 10,
        realism_hiring_trends_points: 5,
        realism_seniority_match_points: 5,
        realism_location_points: 5,
        strategic_salary_points: 5,
        strategic_industry_points: 3,
        strategic_growth_points: 2
      };
    }
    
    return data;
  } catch (error) {
    console.error('Failed to get scoring config:', error);
    return getDefaultConfig();
  }
}

function getDefaultConfig() {
  return {
    visa_weight: 50,
    relevance_weight: 25,
    realism_weight: 15,
    strategic_weight: 10,
    visa_registry_points: 20,
    visa_recent_activity_points: 15,
    visa_community_signals_points: 10,
    visa_jd_keywords_points: 5,
    relevance_skills_points: 15,
    relevance_experience_points: 10,
    realism_hiring_trends_points: 5,
    realism_seniority_match_points: 5,
    realism_location_points: 5,
    strategic_salary_points: 5,
    strategic_industry_points: 3,
    strategic_growth_points: 2
  };
}

function calculateVisaScore(visaData, config) {
  const components = {
    registry: visaData.breakdown?.registry || 0,
    recent_activity: visaData.breakdown?.recent_activity || 0,
    community: visaData.breakdown?.community || 0,
    jd_keywords: visaData.breakdown?.jd_keywords || 0,
    penalties: visaData.breakdown?.penalties || 0
  };
  
  const total = Math.max(0, Math.min(50,
    components.registry +
    components.recent_activity +
    components.community +
    components.jd_keywords +
    components.penalties
  ));
  
  return { total, components };
}

function calculateRelevanceScore(normalized, userProfile, config) {
  if (!userProfile) {
    return {
      total: 0,
      components: { skills: 0, experience: 0 }
    };
  }
  
  // Skills matching
  const userSkills = userProfile.skills || [];
  const jobSkills = normalized.skills || [];
  
  let matchedSkills = 0;
  if (userSkills.length > 0 && jobSkills.length > 0) {
    const userSkillsLower = userSkills.map(s => s.toLowerCase());
    const jobSkillsLower = jobSkills.map(s => s.toLowerCase());
    
    matchedSkills = jobSkillsLower.filter(skill => 
      userSkillsLower.includes(skill)
    ).length;
  }
  
  const skillsMatchRatio = jobSkills.length > 0 
    ? matchedSkills / jobSkills.length 
    : 0;
  const skillsScore = Math.round(skillsMatchRatio * config.relevance_skills_points);
  
  // Experience matching
  const userExp = userProfile.years_of_experience || 0;
  const jobExpPattern = extractExperienceRequirement(normalized.normalized_text);
  
  let experienceScore = 0;
  if (jobExpPattern) {
    const { min, max } = jobExpPattern;
    if (userExp >= min && userExp <= (max || min + 5)) {
      experienceScore = config.relevance_experience_points;
    } else if (userExp >= min) {
      experienceScore = Math.round(config.relevance_experience_points * 0.8);
    } else if (userExp >= min - 1) {
      experienceScore = Math.round(config.relevance_experience_points * 0.5);
    }
  } else {
    // No clear requirement, give partial credit
    experienceScore = Math.round(config.relevance_experience_points * 0.6);
  }
  
  return {
    total: skillsScore + experienceScore,
    components: {
      skills: skillsScore,
      experience: experienceScore
    }
  };
}

function calculateRealismScore(normalized, userProfile, config) {
  // Hiring trends score - based on how recent the posting is
  let hiringScore = 0;
  if (normalized.posting_date) {
    const daysOld = Math.floor(
      (new Date() - new Date(normalized.posting_date)) / (1000 * 60 * 60 * 24)
    );
    
    if (daysOld <= 7) hiringScore = config.realism_hiring_trends_points;
    else if (daysOld <= 14) hiringScore = Math.round(config.realism_hiring_trends_points * 0.8);
    else if (daysOld <= 30) hiringScore = Math.round(config.realism_hiring_trends_points * 0.5);
  } else {
    // Unknown date, give partial credit
    hiringScore = Math.round(config.realism_hiring_trends_points * 0.5);
  }
  
  // Seniority match
  let seniorityScore = 0;
  if (userProfile) {
    const jobSeniority = detectSeniorityLevel(normalized.title, normalized.normalized_text);
    const userSeniority = getUserSeniorityLevel(userProfile.years_of_experience);
    
    if (jobSeniority === userSeniority) {
      seniorityScore = config.realism_seniority_match_points;
    } else if (Math.abs(jobSeniority - userSeniority) === 1) {
      seniorityScore = Math.round(config.realism_seniority_match_points * 0.6);
    }
  } else {
    seniorityScore = Math.round(config.realism_seniority_match_points * 0.5);
  }
  
  // Location accessibility
  let locationScore = config.realism_location_points;
  if (userProfile?.preferred_locations) {
    const matchesPreferred = userProfile.preferred_locations.some(loc =>
      normalized.location?.toLowerCase().includes(loc.toLowerCase())
    );
    if (!matchesPreferred) {
      locationScore = Math.round(config.realism_location_points * 0.6);
    }
  }
  
  // Penalize agency recruiters
  if (normalized.recruiter_type === 'agency') {
    hiringScore = Math.round(hiringScore * 0.7);
  }
  
  return {
    total: hiringScore + seniorityScore + locationScore,
    components: {
      hiring_trends: hiringScore,
      seniority_match: seniorityScore,
      location: locationScore
    }
  };
}

function calculateStrategicScore(normalized, visaData, config) {
  // Salary score - already checked in visa intelligence
  const salaryScore = visaData.breakdown?.penalties >= -10
    ? config.strategic_salary_points
    : Math.round(config.strategic_salary_points * 0.3);
  
  // Industry demand score
  const demandIndustries = ['FinTech', 'AI/ML', 'Security', 'SaaS'];
  const isHighDemand = normalized.domains?.some(d => demandIndustries.includes(d));
  const industryScore = isHighDemand
    ? config.strategic_industry_points
    : Math.round(config.strategic_industry_points * 0.5);
  
  // Growth potential - heuristic based on company type and role
  let growthScore = Math.round(config.strategic_growth_points * 0.5);
  const growthKeywords = ['senior', 'lead', 'principal', 'staff', 'architect'];
  if (growthKeywords.some(kw => normalized.title?.toLowerCase().includes(kw))) {
    growthScore = config.strategic_growth_points;
  }
  
  return {
    total: salaryScore + industryScore + growthScore,
    components: {
      salary: salaryScore,
      industry: industryScore,
      growth: growthScore
    }
  };
}

function extractExperienceRequirement(text) {
  const patterns = [
    /(\d+)\+?\s*(?:to|-)\s*(\d+)\s*years?/i,
    /(\d+)\+\s*years?/i,
    /minimum\s+(\d+)\s*years?/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const min = parseInt(match[1]);
      const max = match[2] ? parseInt(match[2]) : null;
      return { min, max };
    }
  }
  
  return null;
}

function detectSeniorityLevel(title, text) {
  const titleLower = (title || '').toLowerCase();
  const textLower = text.toLowerCase();
  
  if (/(intern|graduate|junior|entry)/i.test(titleLower)) return 1;
  if (/(mid|intermediate)/i.test(titleLower)) return 2;
  if (/(senior|sr\.)/i.test(titleLower)) return 3;
  if (/(lead|principal|staff)/i.test(titleLower)) return 4;
  if (/(architect|director|vp|head)/i.test(titleLower)) return 5;
  
  // Fallback to experience years
  const expPattern = extractExperienceRequirement(textLower);
  if (expPattern) {
    if (expPattern.min <= 2) return 1;
    if (expPattern.min <= 4) return 2;
    if (expPattern.min <= 7) return 3;
    return 4;
  }
  
  return 2; // Default to mid-level
}

function getUserSeniorityLevel(yearsExp) {
  if (!yearsExp) return 2;
  if (yearsExp <= 2) return 1;
  if (yearsExp <= 4) return 2;
  if (yearsExp <= 7) return 3;
  if (yearsExp <= 10) return 4;
  return 5;
}

function generateRecommendation(totalScore, visaScore, config) {
  let priority = 'CONSIDER';
  let emoji = '⭐⭐⭐';
  
  if (totalScore >= 85 && visaScore.total >= 40) {
    priority = 'APPLY NOW';
    emoji = '⭐⭐⭐⭐⭐';
  } else if (totalScore >= 70 && visaScore.total >= 30) {
    priority = 'STRONG MATCH';
    emoji = '⭐⭐⭐⭐';
  } else if (totalScore >= 50) {
    priority = 'CONSIDER';
    emoji = '⭐⭐⭐';
  } else if (totalScore >= 30) {
    priority = 'LOW PRIORITY';
    emoji = '⭐⭐';
  } else {
    priority = 'SKIP';
    emoji = '⭐';
  }
  
  const visaConfidence = visaScore.total >= 40 ? 'HIGH' : 
                        visaScore.total >= 25 ? 'MEDIUM' : 'LOW';
  
  return `${emoji} ${priority} - Visa Likelihood: ${visaConfidence}`;
}
