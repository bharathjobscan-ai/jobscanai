/**
 * Computes visa sponsorship likelihood from normalized job data
 * @param {Object} normalized - Normalized job data
 * @param {Array} companyRegistry - Array of companies known to sponsor
 * @returns {Object} Visa scoring result
 */
function computeVisaFromNormalized(normalized, companyRegistry) {
  const text = (normalized.normalized_text || '').toLowerCase();
  const company = (normalized.company || '').toLowerCase();
  const title = (normalized.title || '').toLowerCase();
  
  let visa_score_int = 0;
  let visa_confidence = 'low';
  const visa_categories = [];
  const explanations = [];
  
  // Check for explicit visa sponsorship mentions
  const visaKeywords = {
    high: [
      'visa sponsorship',
      'h1b sponsorship',
      'will sponsor',
      'sponsor visa',
      'h-1b available',
      'visa transfer'
    ],
    medium: [
      'h1b',
      'h-1b',
      'work authorization',
      'sponsorship available',
      'eligible for sponsorship'
    ],
    negative: [
      'no visa sponsorship',
      'not sponsoring',
      'must be authorized',
      'us citizenship required',
      'security clearance required'
    ]
  };
  
  // Check for high-confidence keywords
  for (const keyword of visaKeywords.high) {
    if (text.includes(keyword)) {
      visa_score_int = 90;
      visa_confidence = 'high';
      visa_categories.push('explicit_sponsorship');
      explanations.push(`Found explicit mention: "${keyword}"`);
      break;
    }
  }
  
  // Check for negative keywords
  if (visa_score_int === 0) {
    for (const keyword of visaKeywords.negative) {
      if (text.includes(keyword)) {
        visa_score_int = 10;
        visa_confidence = 'high';
        visa_categories.push('explicit_no_sponsorship');
        explanations.push(`Found negative mention: "${keyword}"`);
        break;
      }
    }
  }
  
  // Check for medium-confidence keywords
  if (visa_score_int === 0) {
    for (const keyword of visaKeywords.medium) {
      if (text.includes(keyword)) {
        visa_score_int = 60;
        visa_confidence = 'medium';
        visa_categories.push('visa_mentioned');
        explanations.push(`Found visa reference: "${keyword}"`);
        break;
      }
    }
  }
  
  // Check company registry
  const companyMatch = companyRegistry.find(c => 
    company.includes(c.name.toLowerCase()) || 
    c.name.toLowerCase().includes(company)
  );
  
  if (companyMatch) {
    if (companyMatch.sponsors_visa) {
      if (visa_score_int === 0) {
        visa_score_int = 70;
        visa_confidence = 'medium';
      } else {
        visa_score_int = Math.min(95, visa_score_int + 10);
      }
      visa_categories.push('known_sponsor');
      explanations.push(`Company "${companyMatch.name}" is a known visa sponsor`);
    }
  }
  
  // Default score if nothing found
  if (visa_score_int === 0) {
    visa_score_int = 30;
    visa_confidence = 'low';
    visa_categories.push('no_information');
    explanations.push('No explicit visa information found');
  }
  
  return {
    visa_confidence,
    visa_score_int,
    visa_categories,
    explanation: explanations.join('; ')
  };
}

module.exports = { computeVisaFromNormalized };
