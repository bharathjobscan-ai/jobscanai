const cheerio = require('cheerio');

/**
 * Normalizes HTML job posting into structured data
 * @param {string} html - Raw HTML content
 * @param {string} url - Source URL
 * @returns {Object} Normalized job data
 */
function normalizeHtml(html, url) {
  const $ = cheerio.load(html);
  
  // Remove script and style tags
  $('script, style').remove();
  
  // Extract title - common selectors for job titles
  let title = $('h1').first().text().trim() ||
              $('[class*="title"]').first().text().trim() ||
              $('[class*="job-title"]').first().text().trim() ||
              $('title').text().trim() ||
              'Unknown Title';
  
  // Extract company name - common selectors
  let company = $('[class*="company"]').first().text().trim() ||
                $('[class*="employer"]').first().text().trim() ||
                $('[data-testid*="company"]').first().text().trim() ||
                'Unknown Company';
  
  // Extract location - common selectors
  let location = $('[class*="location"]').first().text().trim() ||
                 $('[class*="job-location"]').first().text().trim() ||
                 'Unknown Location';
  
  // Get full text content for analysis
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  
  // Extract skill tags using common tech keywords
  const skillKeywords = [
    'JavaScript', 'Python', 'Java', 'C++', 'React', 'Node.js', 'Angular',
    'Vue', 'TypeScript', 'SQL', 'MongoDB', 'PostgreSQL', 'AWS', 'Azure',
    'GCP', 'Docker', 'Kubernetes', 'Git', 'REST', 'GraphQL', 'API',
    'Machine Learning', 'AI', 'Data Science', 'DevOps', 'Agile', 'Scrum'
  ];
  
  const skill_tags = skillKeywords.filter(skill => 
    bodyText.toLowerCase().includes(skill.toLowerCase())
  );
  
  // Extract domain tags
  const domainKeywords = [
    'Frontend', 'Backend', 'Full Stack', 'DevOps', 'Data Engineering',
    'Machine Learning', 'Cloud', 'Mobile', 'Security', 'QA', 'Testing'
  ];
  
  const domain_tags = domainKeywords.filter(domain =>
    bodyText.toLowerCase().includes(domain.toLowerCase())
  );
  
  // Create normalized text (first 2000 chars)
  const normalized_text = bodyText.substring(0, 2000);
  
  return {
    title: title.substring(0, 255),
    company: company.substring(0, 255),
    location: location.substring(0, 255),
    normalized_text,
    skill_tags,
    domain_tags
  };
}

module.exports = { normalizeHtml };
