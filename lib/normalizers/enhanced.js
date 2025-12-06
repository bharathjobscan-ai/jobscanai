// Enhanced HTML Normalizer
// Extracts job data with improved parsing for salary, location, and other fields

import * as cheerio from 'cheerio';

export function normalizeJobHTML(html, sourceUrl) {
  const $ = cheerio.load(html);
  
  // Remove script and style tags
  $('script, style, noscript').remove();
  
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  
  return {
    title: extractTitle($, text),
    company: extractCompany($, text),
    location: extractLocation($, text),
    country_code: extractCountryCode($, text),
    salary: extractSalary($, text),
    skills: extractSkills(text),
    domains: extractDomains(text),
    normalized_text: text,
    is_remote: detectRemote(text),
    recruiter_email: extractRecruiterEmail($, text),
    recruiter_type: classifyRecruiterType($, text),
    posting_date: extractPostingDate($, text)
  };
}

function extractTitle($, text) {
  // Try common meta tags first
  const ogTitle = $('meta[property="og:title"]').attr('content');
  if (ogTitle && ogTitle.length > 5) return ogTitle.trim();
  
  const twitterTitle = $('meta[name="twitter:title"]').attr('content');
  if (twitterTitle && twitterTitle.length > 5) return twitterTitle.trim();
  
  // Try h1 tags
  const h1 = $('h1').first().text().trim();
  if (h1 && h1.length > 5 && h1.length < 200) return h1;
  
  // Try title tag
  const pageTitle = $('title').text().trim();
  if (pageTitle) {
    // Clean common suffixes
    return pageTitle
      .replace(/\s*[\|–-]\s*(Careers|Jobs|LinkedIn|Indeed|Reed|Adzuna).*$/i, '')
      .trim();
  }
  
  return 'Unknown Position';
}

function extractCompany($, text) {
  // Try meta tags
  const ogSiteName = $('meta[property="og:site_name"]').attr('content');
  if (ogSiteName) return ogSiteName.trim();
  
  // Common patterns
  const patterns = [
    /(?:at|@)\s+([A-Z][A-Za-z0-9\s&.,-]{2,50})(?:\s+(?:in|located|based))/i,
    /Company:\s*([A-Z][A-Za-z0-9\s&.,-]{2,50})/i,
    /Employer:\s*([A-Z][A-Za-z0-9\s&.,-]{2,50})/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  
  return 'Unknown Company';
}

function extractLocation($, text) {
  // Try structured data
  const schemaLocation = $('script[type="application/ld+json"]')
    .toArray()
    .map(el => {
      try {
        const data = JSON.parse($(el).html());
        return data.jobLocation?.address?.addressLocality || 
               data.jobLocation?.address?.addressRegion ||
               data.address?.addressLocality;
      } catch (e) {
        return null;
      }
    })
    .find(loc => loc);
  
  if (schemaLocation) return schemaLocation;
  
  // Common location patterns
  const patterns = [
    /Location:\s*([A-Z][A-Za-z\s,.-]{3,80})/i,
    /(?:in|at)\s+([A-Z][a-z]+(?:,\s*[A-Z][a-z]+)?(?:,\s*[A-Z]{2,3})?)/,
    /(London|Amsterdam|Berlin|Stockholm|Dubai|Toronto|Sydney|Manchester|Rotterdam|Munich|Gothenburg|Melbourne|Vancouver)/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  
  return null;
}

function extractCountryCode($, text) {
  const locationText = (extractLocation($, text) || '').toLowerCase();
  const fullText = text.toLowerCase();
  
  const countryMap = {
    'GB': ['london', 'manchester', 'edinburgh', 'birmingham', 'uk', 'united kingdom', 'england', 'scotland', 'wales'],
    'NL': ['amsterdam', 'rotterdam', 'the hague', 'utrecht', 'eindhoven', 'netherlands', 'holland'],
    'DE': ['berlin', 'munich', 'frankfurt', 'hamburg', 'cologne', 'germany', 'deutschland'],
    'SE': ['stockholm', 'gothenburg', 'malmö', 'uppsala', 'sweden', 'sverige'],
    'AE': ['dubai', 'abu dhabi', 'uae', 'united arab emirates'],
    'AU': ['sydney', 'melbourne', 'brisbane', 'perth', 'adelaide', 'australia'],
    'CA': ['toronto', 'vancouver', 'montreal', 'calgary', 'ottawa', 'canada']
  };
  
  for (const [code, keywords] of Object.entries(countryMap)) {
    if (keywords.some(kw => locationText.includes(kw) || fullText.includes(kw))) {
      return code;
    }
  }
  
  return null;
}

function extractSalary($, text) {
  const patterns = [
    // GBP formats
    /£([\d,]+)(?:\s*-\s*£?([\d,]+))?(?:\s*(?:per|\/)\s*(year|annum|month|hour))?/i,
    /(?:salary|compensation|pay):\s*£([\d,]+)(?:\s*-\s*£?([\d,]+))?/i,
    
    // EUR formats
    /€([\d,]+)(?:\s*-\s*€?([\d,]+))?(?:\s*(?:per|\/)\s*(year|annum|month|hour))?/i,
    
    // USD/AUD/CAD formats
    /\$([\d,]+)(?:\s*-\s*\$?([\d,]+))?(?:\s*(?:per|\/)\s*(year|annum|month|hour))?/i,
    
    // SEK formats
    /([\d,]+)\s*SEK(?:\s*-\s*([\d,]+)\s*SEK)?/i,
    
    // Written formats
    /([\d,]+)(?:\s*to\s*([\d,]+))?\s*(GBP|EUR|USD|AUD|CAD|SEK)/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const min = parseInt(match[1].replace(/,/g, ''));
      const max = match[2] ? parseInt(match[2].replace(/,/g, '')) : min;
      
      let currency = 'GBP'; // default
      if (text.includes('€') || text.includes('EUR')) currency = 'EUR';
      else if (text.includes('$USD') || text.includes('USD')) currency = 'USD';
      else if (text.includes('$AUD') || text.includes('AUD')) currency = 'AUD';
      else if (text.includes('$CAD') || text.includes('CAD')) currency = 'CAD';
      else if (text.includes('SEK')) currency = 'SEK';
      
      return {
        raw: match[0],
        min,
        max,
        currency,
        period: match[3] || 'year'
      };
    }
  }
  
  return null;
}

function extractSkills(text) {
  const skillKeywords = [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Rust', 'Ruby', 'PHP',
    'React', 'Angular', 'Vue', 'Node.js', 'Express', 'Django', 'Flask', 'Spring', 'Laravel',
    'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Terraform', 'Jenkins', 'GitLab',
    'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'Kafka', 'RabbitMQ',
    'GraphQL', 'REST', 'API', 'Microservices', 'CI/CD', 'DevOps', 'Agile', 'Scrum',
    'Machine Learning', 'AI', 'Data Science', 'TensorFlow', 'PyTorch', 'Pandas',
    'Linux', 'Git', 'SQL', 'NoSQL', 'HTML', 'CSS', 'SASS', 'Webpack', 'Babel'
  ];
  
  const found = new Set();
  const lowerText = text.toLowerCase();
  
  for (const skill of skillKeywords) {
    const pattern = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (pattern.test(text)) {
      found.add(skill);
    }
  }
  
  return Array.from(found);
}

function extractDomains(text) {
  const domains = [];
  
  const domainKeywords = {
    'FinTech': /\b(fintech|financial technology|payment|banking|trading|blockchain|crypto)\b/i,
    'E-commerce': /\b(e-commerce|ecommerce|retail|marketplace|shopping)\b/i,
    'HealthTech': /\b(health|medical|healthcare|biotech|pharmaceutical)\b/i,
    'EdTech': /\b(education|learning|edtech|teaching)\b/i,
    'SaaS': /\b(saas|software as a service|b2b software|enterprise software)\b/i,
    'Gaming': /\b(gaming|game|esports|entertainment)\b/i,
    'Security': /\b(security|cybersecurity|infosec|encryption)\b/i,
    'AI/ML': /\b(artificial intelligence|machine learning|deep learning|neural network)\b/i
  };
  
  for (const [domain, pattern] of Object.entries(domainKeywords)) {
    if (pattern.test(text)) {
      domains.push(domain);
    }
  }
  
  return domains;
}

function detectRemote(text) {
  const remotePatterns = [
    /\bremote\b/i,
    /\bwork from home\b/i,
    /\bhome.?based\b/i,
    /\bdistributed\b/i,
    /\banywhere\b/i,
    /\bhybrid\b/i
  ];
  
  return remotePatterns.some(pattern => pattern.test(text));
}

function extractRecruiterEmail($, text) {
  // Look for email addresses
  const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  const emails = text.match(emailPattern);
  
  if (!emails || emails.length === 0) return null;
  
  // Prefer @company.com emails over @recruitment.com
  const companyEmail = emails.find(e => !/(recruit|agency|talent|hr|jobs)/.test(e.toLowerCase()));
  return companyEmail || emails[0];
}

function classifyRecruiterType($, text) {
  const agencyPatterns = [
    /\b(recruitment|recruiting|talent|staffing|headhunt)\s+(agency|firm|consultant)/i,
    /@(hays|reed|adecco|manpower|randstad|robert.*half)/i,
    /on behalf of/i
  ];
  
  if (agencyPatterns.some(p => p.test(text))) {
    return 'agency';
  }
  
  return 'internal';
}

function extractPostingDate($, text) {
  // Try schema.org structured data
  const schemaDate = $('script[type="application/ld+json"]')
    .toArray()
    .map(el => {
      try {
        const data = JSON.parse($(el).html());
        return data.datePosted;
      } catch (e) {
        return null;
      }
    })
    .find(date => date);
  
  if (schemaDate) return schemaDate;
  
  // Try meta tags
  const publishedTime = $('meta[property="article:published_time"]').attr('content');
  if (publishedTime) return publishedTime;
  
  // Try to find dates in text
  const datePatterns = [
    /Posted:\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
    /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i
  ];
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      return new Date(match[1]).toISOString().split('T')[0];
    }
  }
  
  return null;
}
