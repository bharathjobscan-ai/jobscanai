// Enhanced Visa Intelligence Engine
// Multi-tier visa sponsorship analysis using government registries and signals

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export async function analyzeVisaSponsorship(company, location, jobDescription, salary) {
  const countryCode = detectCountryCode(location, jobDescription);
  
  // Tier 1: Official Registry Check
  const registryMatch = await checkOfficialRegistry(company, countryCode);
  
  // Tier 2: Community Intelligence
  const communitySignals = await checkCommunityIntelligence(company);
  
  // Tier 3: Job Description Analysis
  const jdSignals = analyzeJobDescriptionKeywords(jobDescription);
  
  // Recent Activity Check
  const recentActivity = await checkRecentSponsorActivity(company, countryCode);
  
  // Salary Threshold Check
  const salaryCheck = await checkSalaryThreshold(salary, countryCode);
  
  // Calculate scores
  const registryScore = registryMatch.found ? 20 : 0;
  const recentActivityScore = Math.min(recentActivity.count * 3, 15);
  const communityScore = calculateCommunityScore(communitySignals);
  const jdKeywordsScore = jdSignals.score;
  
  // Apply penalties
  let penalties = 0;
  if (jdSignals.hasNegativeSignal) penalties -= 30;
  if (communitySignals.negativeCount > communitySignals.positiveCount) penalties -= 15;
  if (!salaryCheck.meetsThreshold) penalties -= 20;
  
  const totalScore = Math.max(0, Math.min(100, 
    registryScore + recentActivityScore + communityScore + jdKeywordsScore + penalties
  ));
  
  return {
    score: totalScore,
    confidence: getConfidenceLevel(totalScore, registryMatch.found),
    categories: determineVisaCategories(countryCode, salary),
    explanation: buildExplanation({
      registryMatch,
      recentActivity,
      communitySignals,
      jdSignals,
      salaryCheck,
      penalties
    }),
    registry_match: registryMatch.found,
    recent_activity_score: recentActivityScore,
    community_score: communityScore,
    jd_keywords_score: jdKeywordsScore,
    breakdown: {
      registry: registryScore,
      recent_activity: recentActivityScore,
      community: communityScore,
      jd_keywords: jdKeywordsScore,
      penalties
    }
  };
}

function detectCountryCode(location, text) {
  const locationLower = (location || '').toLowerCase();
  const textLower = text.toLowerCase();
  
  const countryMap = {
    'GB': ['london', 'manchester', 'edinburgh', 'birmingham', 'uk', 'united kingdom'],
    'NL': ['amsterdam', 'rotterdam', 'the hague', 'utrecht', 'netherlands'],
    'DE': ['berlin', 'munich', 'frankfurt', 'hamburg', 'germany'],
    'SE': ['stockholm', 'gothenburg', 'malmö', 'sweden'],
    'AE': ['dubai', 'abu dhabi', 'uae'],
    'AU': ['sydney', 'melbourne', 'brisbane', 'australia'],
    'CA': ['toronto', 'vancouver', 'montreal', 'canada']
  };
  
  for (const [code, keywords] of Object.entries(countryMap)) {
    if (keywords.some(kw => locationLower.includes(kw) || textLower.includes(kw))) {
      return code;
    }
  }
  
  return null;
}

async function checkOfficialRegistry(company, countryCode) {
  if (!company || !countryCode) {
    return { found: false, source: null };
  }
  
  try {
    // Normalize company name for matching
    const normalizedCompany = company.toLowerCase().trim();
    
    const { data, error } = await supabase
      .from('visa_sponsor_registry')
      .select('*')
      .eq('country_code', countryCode)
      .eq('is_active', true)
      .ilike('company_name', `%${normalizedCompany}%`)
      .limit(1);
    
    if (error) {
      console.error('Registry check error:', error);
      return { found: false, source: null };
    }
    
    if (data && data.length > 0) {
      return {
        found: true,
        source: data[0].registry_source,
        license: data[0].license_number,
        valid_until: data[0].valid_until
      };
    }
    
    return { found: false, source: null };
  } catch (error) {
    console.error('Registry check failed:', error);
    return { found: false, source: null };
  }
}

async function checkCommunityIntelligence(company) {
  if (!company) {
    return { positiveCount: 0, negativeCount: 0, signals: [] };
  }
  
  try {
    const { data, error } = await supabase
      .from('community_intelligence')
      .select('*')
      .ilike('company_name', `%${company}%`)
      .order('mentioned_at', { ascending: false })
      .limit(20);
    
    if (error || !data) {
      return { positiveCount: 0, negativeCount: 0, signals: [] };
    }
    
    const positive = data.filter(s => s.sentiment === 'positive').length;
    const negative = data.filter(s => s.sentiment === 'negative').length;
    
    return {
      positiveCount: positive,
      negativeCount: negative,
      signals: data
    };
  } catch (error) {
    console.error('Community intelligence check failed:', error);
    return { positiveCount: 0, negativeCount: 0, signals: [] };
  }
}

function analyzeJobDescriptionKeywords(text) {
  const lowerText = text.toLowerCase();
  
  // Positive signals
  const positiveKeywords = [
    'visa sponsorship',
    'work permit',
    'relocation support',
    'relocation package',
    'right to work',
    'eligible to work',
    'sponsorship available',
    'sponsor visa',
    'work authorization',
    'immigration support'
  ];
  
  // Negative signals
  const negativeKeywords = [
    'no sponsorship',
    'must have right to work',
    'existing work permit',
    'already eligible',
    'sponsorship not available',
    'no visa support',
    'cannot sponsor',
    'visa not provided'
  ];
  
  let positiveCount = 0;
  let hasNegativeSignal = false;
  
  for (const keyword of positiveKeywords) {
    if (lowerText.includes(keyword)) {
      positiveCount++;
    }
  }
  
  for (const keyword of negativeKeywords) {
    if (lowerText.includes(keyword)) {
      hasNegativeSignal = true;
      break;
    }
  }
  
  const score = Math.min(positiveCount * 2, 5);
  
  return {
    score: hasNegativeSignal ? 0 : score,
    hasNegativeSignal,
    positiveMatches: positiveCount
  };
}

async function checkRecentSponsorActivity(company, countryCode) {
  if (!company) {
    return { count: 0, recent: [] };
  }
  
  try {
    // Check for recent entries in last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const { data, error } = await supabase
      .from('visa_sponsor_registry')
      .select('*')
      .ilike('company_name', `%${company}%`)
      .gte('created_at', sixMonthsAgo.toISOString())
      .order('created_at', { ascending: false });
    
    if (error || !data) {
      return { count: 0, recent: [] };
    }
    
    return {
      count: data.length,
      recent: data
    };
  } catch (error) {
    console.error('Recent activity check failed:', error);
    return { count: 0, recent: [] };
  }
}

async function checkSalaryThreshold(salary, countryCode) {
  if (!salary || !salary.min || !countryCode) {
    return { meetsThreshold: false, threshold: null };
  }
  
  try {
    const { data, error } = await supabase
      .from('visa_salary_thresholds')
      .select('*')
      .eq('country_code', countryCode)
      .eq('currency', salary.currency)
      .order('min_salary_annual', { ascending: true })
      .limit(1);
    
    if (error || !data || data.length === 0) {
      return { meetsThreshold: false, threshold: null };
    }
    
    const threshold = data[0];
    const meetsThreshold = salary.min >= threshold.min_salary_annual;
    
    return {
      meetsThreshold,
      threshold: threshold.min_salary_annual,
      visaType: threshold.visa_type
    };
  } catch (error) {
    console.error('Salary threshold check failed:', error);
    return { meetsThreshold: false, threshold: null };
  }
}

function calculateCommunityScore(communitySignals) {
  const { positiveCount, negativeCount } = communitySignals;
  
  if (positiveCount === 0 && negativeCount === 0) {
    return 0;
  }
  
  const netPositive = positiveCount - negativeCount;
  const score = Math.max(0, Math.min(netPositive * 2, 10));
  
  return score;
}

function getConfidenceLevel(score, hasRegistryMatch) {
  if (hasRegistryMatch && score >= 80) return 'very_high';
  if (hasRegistryMatch && score >= 60) return 'high';
  if (score >= 70) return 'high';
  if (score >= 50) return 'medium';
  if (score >= 30) return 'low';
  return 'very_low';
}

function determineVisaCategories(countryCode, salary) {
  const categories = [];
  
  const categoryMap = {
    'GB': ['Skilled Worker Visa', 'Global Talent Visa'],
    'NL': ['Highly Skilled Migrant', '30% Ruling'],
    'DE': ['EU Blue Card', 'Skilled Worker Residence Permit'],
    'SE': ['Work Permit for Skilled Workers'],
    'AE': ['Employment Visa'],
    'AU': ['Temporary Skill Shortage (TSS)', 'Employer Nomination Scheme'],
    'CA': ['LMIA Work Permit', 'Provincial Nominee Program']
  };
  
  if (countryCode && categoryMap[countryCode]) {
    categories.push(...categoryMap[countryCode]);
  }
  
  return categories;
}

function buildExplanation(data) {
  const parts = [];
  
  if (data.registryMatch.found) {
    parts.push(`✅ Company is on official ${data.registryMatch.source} sponsor registry`);
  } else {
    parts.push('⚠️ Company not found in official sponsor registries');
  }
  
  if (data.recentActivity.count > 0) {
    parts.push(`✅ ${data.recentActivity.count} recent sponsorship activities in last 6 months`);
  }
  
  if (data.communitySignals.positiveCount > 0) {
    parts.push(`✅ ${data.communitySignals.positiveCount} positive community mentions about sponsorship`);
  }
  
  if (data.communitySignals.negativeCount > 0) {
    parts.push(`⚠️ ${data.communitySignals.negativeCount} negative community mentions`);
  }
  
  if (data.jdSignals.positiveMatches > 0) {
    parts.push(`✅ Job description mentions visa/sponsorship ${data.jdSignals.positiveMatches} times`);
  }
  
  if (data.jdSignals.hasNegativeSignal) {
    parts.push('❌ Job description explicitly states no sponsorship');
  }
  
  if (data.salaryCheck.meetsThreshold) {
    parts.push(`✅ Salary meets minimum threshold for ${data.salaryCheck.visaType}`);
  } else if (data.salaryCheck.threshold) {
    parts.push(`⚠️ Salary below minimum threshold of ${data.salaryCheck.threshold}`);
  }
  
  if (data.penalties < 0) {
    parts.push(`⚠️ Penalties applied: ${Math.abs(data.penalties)} points`);
  }
  
  return parts.join('\n');
}
