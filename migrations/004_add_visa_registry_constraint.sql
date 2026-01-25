-- Add unique constraint to visa_sponsor_registry
-- This allows proper upsert operations when importing sponsor data

-- First, remove any potential duplicates
DELETE FROM visa_sponsor_registry a
USING visa_sponsor_registry b
WHERE a.id < b.id 
  AND a.company_name = b.company_name 
  AND a.country_code = b.country_code;

-- Add unique constraint
ALTER TABLE visa_sponsor_registry
ADD CONSTRAINT visa_sponsor_registry_company_country_unique 
UNIQUE (company_name, country_code);

-- Add comment
COMMENT ON CONSTRAINT visa_sponsor_registry_company_country_unique ON visa_sponsor_registry 
IS 'Ensures one record per company per country in sponsor registry';
