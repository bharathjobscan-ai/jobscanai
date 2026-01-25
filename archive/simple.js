/**
 * Computes overall job relevance score
 * @param {Object} normalized - Normalized job data
 * @param {Object} resumeBaseline - User's resume baseline with skills and preferences
 * @param {number} visa_score - Visa score (0-100)
 * @returns {number} Overall relevance score (0-100)
 */
function computeScore(normalized, resumeBaseline, visa_score) {
  // Weights for different components
  const weights = {
    visa: 0.4,
    resumeRelevance: 0.25,
    skills: 0.2,
    company: 0.1,
    domain: 0.05
  };
  
  // Visa score (already 0-100)
  const visaComponent = visa_score;
  
  // Resume relevance score
  const resumeRelevanceScore = computeResumeRelevance(normalized, resumeBaseline);
  
  // Skills match score
  const skillsScore = computeSkillsMatch(normalized.skill_tags || [], resumeBaseline.skills || []);
  
  // Company score (placeholder - can be enhanced with company rankings)
  const companyScore = computeCompanyScore(normalized.company, resumeBaseline.preferred_companies || []);
  
  // Domain match score
  const domainScore = computeDomainMatch(normalized.domain_tags || [], resumeBaseline.domains || []);
  
  // Weighted sum
  let totalScore = 
    visaComponent * weights.visa +
    resumeRelevanceScore * weights.resumeRelevance +
    skillsScore * weights.skills +
    companyScore * weights.company +
    domainScore * weights.domain;
  
  // Floor multiplier logic: if visa score is very low, reduce overall score
  if (visa_score < 30) {
    totalScore *= 0.5; // 50% penalty for low visa scores
  } else if (visa_score < 50) {
    totalScore *= 0.75; // 25% penalty for medium-low visa scores
  }
  
  // Ensure score is between 0 and 100
  return Math.max(0, Math.min(100, Math.round(totalScore)));
}

/**
 * Computes resume relevance based on job text
 */
function computeResumeRelevance(normalized, resumeBaseline) {
  if (!resumeBaseline.keywords || resumeBaseline.keywords.length === 0) {
    return 50; // Default neutral score if no baseline
  }
  
  const text = (normalized.normalized_text || '').toLowerCase();
  const title = (normalized.title || '').toLowerCase();
  
  let matches = 0;
  for (const keyword of resumeBaseline.keywords) {
    if (text.includes(keyword.toLowerCase()) || title.includes(keyword.toLowerCase())) {
      matches++;
    }
  }
  
  // Score based on percentage of keywords found
  const matchRate = matches / resumeBaseline.keywords.length;
  return Math.min(100, matchRate * 120); // Boost to allow high scores
}

/**
 * Computes skills match score
 */
function computeSkillsMatch(jobSkills, resumeSkills) {
  if (!resumeSkills || resumeSkills.length === 0) {
    return 50; // Default neutral score
  }
  
  if (!jobSkills || jobSkills.length === 0) {
    return 30; // Low score if no skills detected
  }
  
  const resumeSkillsLower = resumeSkills.map(s => s.toLowerCase());
  const jobSkillsLower = jobSkills.map(s => s.toLowerCase());
  
  let matches = 0;
  for (const skill of resumeSkillsLower) {
    if (jobSkillsLower.some(js => js.includes(skill) || skill.includes(js))) {
      matches++;
    }
  }
  
  const matchRate = matches / resumeSkills.length;
  return Math.min(100, matchRate * 150); // Boost for skill matches
}

/**
 * Computes company score
 */
function computeCompanyScore(company, preferredCompanies) {
  if (!preferredCompanies || preferredCompanies.length === 0) {
    return 50; // Default neutral score
  }
  
  const companyLower = (company || '').toLowerCase();
  
  for (const preferred of preferredCompanies) {
    if (companyLower.includes(preferred.toLowerCase()) || 
        preferred.toLowerCase().includes(companyLower)) {
      return 100; // Perfect match for preferred company
    }
  }
  
  return 40; // Lower score for non-preferred companies
}

/**
 * Computes domain match score
 */
function computeDomainMatch(jobDomains, resumeDomains) {
  if (!resumeDomains || resumeDomains.length === 0) {
    return 50; // Default neutral score
  }
  
  if (!jobDomains || jobDomains.length === 0) {
    return 40; // Low score if no domains detected
  }
  
  const resumeDomainsLower = resumeDomains.map(d => d.toLowerCase());
  const jobDomainsLower = jobDomains.map(d => d.toLowerCase());
  
  let matches = 0;
  for (const domain of resumeDomainsLower) {
    if (jobDomainsLower.some(jd => jd.includes(domain) || domain.includes(jd))) {
      matches++;
    }
  }
  
  const matchRate = matches / resumeDomains.length;
  return Math.min(100, matchRate * 150);
}

module.exports = { computeScore };
