/**
 * Enhanced Profile API with Skill Categorization
 * Supports multi-tier skill classification and detailed preferences
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return getProfile(req, res);
  } else if (req.method === 'POST') {
    return createOrUpdateProfile(req, res);
  } else if (req.method === 'PUT') {
    return updateProfile(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

/**
 * GET - Retrieve user profile
 */
async function getProfile(req, res) {
  try {
    const { data, error } = await supabase
      .from('user_profile')
      .select('*')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({ error: 'db_error', details: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: 'profile_not_found', message: 'No profile exists yet' });
    }

    return res.status(200).json({ profile: data });
  } catch (err) {
    return res.status(500).json({ error: 'unknown', details: err.message });
  }
}

/**
 * POST - Create or fully replace profile
 */
async function createOrUpdateProfile(req, res) {
  try {
    const {
      name,
      email,
      years_of_experience,
      skills_must_have_domain = [],
      skills_must_have_core_pm = [],
      skills_good_to_have = [],
      skills_okay_to_have = [],
      role_flexibility = { preferred: [], acceptable: [] },
      preferred_locations = [],
      target_countries = [],
      salary_expectation = { min: null, max: null, currency: 'GBP' },
      industries = [],
      needs_visa_sponsorship = true,
      resume_text = null,
      resume_url = null,
      
      // Legacy support
      skills = [],
      preferred_roles = []
    } = req.body;

    // Validation
    if (!name || !email) {
      return res.status(400).json({ error: 'validation_error', message: 'Name and email are required' });
    }

    // Merge legacy fields into new structure if provided
    const finalRoleFlexibility = {
      preferred: role_flexibility.preferred.length > 0 ? role_flexibility.preferred : preferred_roles,
      acceptable: role_flexibility.acceptable || []
    };

    // Check if profile exists
    const { data: existing } = await supabase
      .from('user_profile')
      .select('id')
      .limit(1)
      .single();

    const profileData = {
      name,
      email,
      years_of_experience: years_of_experience || 0,
      skills_must_have_domain,
      skills_must_have_core_pm,
      skills_good_to_have,
      skills_okay_to_have,
      role_flexibility: finalRoleFlexibility,
      preferred_locations,
      target_countries,
      salary_expectation,
      industries,
      needs_visa_sponsorship,
      resume_text,
      resume_url,
      skills: skills.length > 0 ? skills : [], // Keep legacy field populated
      updated_at: new Date().toISOString()
    };

    let result;
    if (existing) {
      // Update existing profile
      const { data, error } = await supabase
        .from('user_profile')
        .update(profileData)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        return res.status(500).json({ error: 'db_error', details: error.message });
      }

      // Create version snapshot
      await createVersionSnapshot(existing.id, profileData, 'Full profile update');
      
      result = data;
    } else {
      // Create new profile
      profileData.created_at = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('user_profile')
        .insert([profileData])
        .select()
        .single();

      if (error) {
        return res.status(500).json({ error: 'db_error', details: error.message });
      }

      // Create initial version snapshot
      await createVersionSnapshot(data.id, profileData, 'Initial profile creation');
      
      result = data;
    }

    return res.status(200).json({
      message: 'Profile saved successfully',
      profile: result
    });
  } catch (err) {
    return res.status(500).json({ error: 'unknown', details: err.message });
  }
}

/**
 * PUT - Partial update of profile
 */
async function updateProfile(req, res) {
  try {
    const updates = req.body;

    // Get existing profile
    const { data: existing, error: fetchError } = await supabase
      .from('user_profile')
      .select('*')
      .limit(1)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ error: 'profile_not_found', message: 'Profile does not exist. Use POST to create one.' });
    }

    // Update only provided fields
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('user_profile')
      .update(updates)
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'db_error', details: error.message });
    }

    // Create version snapshot with changed fields
    await createVersionSnapshot(existing.id, updates, 'Partial profile update');

    return res.status(200).json({
      message: 'Profile updated successfully',
      profile: data
    });
  } catch (err) {
    return res.status(500).json({ error: 'unknown', details: err.message });
  }
}

/**
 * Helper: Create version snapshot for audit trail
 */
async function createVersionSnapshot(profileId, changes, reason) {
  try {
    // Get current version number
    const { data: versions } = await supabase
      .from('profile_versions')
      .select('version_number')
      .eq('user_profile_id', profileId)
      .order('version_number', { ascending: false })
      .limit(1);

    const nextVersion = versions && versions.length > 0 ? versions[0].version_number + 1 : 1;

    // Get full current profile for snapshot
    const { data: currentProfile } = await supabase
      .from('user_profile')
      .select('*')
      .eq('id', profileId)
      .single();

    // Create version record
    await supabase
      .from('profile_versions')
      .insert([{
        user_profile_id: profileId,
        version_number: nextVersion,
        changed_fields: changes,
        changed_by: 'user',
        change_reason: reason,
        snapshot: currentProfile
      }]);
  } catch (err) {
    // Non-critical - log but don't fail the main operation
    console.error('Failed to create version snapshot:', err);
  }
}
