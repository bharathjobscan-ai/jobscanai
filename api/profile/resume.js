// Resume Upload and Profile Management API

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return getProfile(req, res);
  } else if (req.method === 'POST') {
    return upsertProfile(req, res);
  } else if (req.method === 'PUT') {
    return updateProfile(req, res);
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}

async function getProfile(req, res) {
  try {
    const { data, error } = await supabase
      .from('user_profile')
      .select('*')
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    return res.status(200).json({
      profile: data || null
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ 
      error: 'Failed to get profile', 
      message: error.message 
    });
  }
}

async function upsertProfile(req, res) {
  try {
    const {
      name,
      email,
      years_of_experience,
      skills,
      preferred_roles,
      preferred_locations,
      target_countries,
      resume_text,
      resume_url
    } = req.body;
    
    // Validate required fields
    if (!name || !years_of_experience) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'name and years_of_experience are required'
      });
    }
    
    // Check if profile exists
    const { data: existing } = await supabase
      .from('user_profile')
      .select('id')
      .limit(1)
      .single();
    
    let result;
    if (existing) {
      // Update existing profile
      const { data, error } = await supabase
        .from('user_profile')
        .update({
          name,
          email,
          years_of_experience,
          skills,
          preferred_roles,
          preferred_locations,
          target_countries,
          resume_text,
          resume_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    } else {
      // Create new profile
      const { data, error } = await supabase
        .from('user_profile')
        .insert({
          name,
          email,
          years_of_experience,
          skills,
          preferred_roles,
          preferred_locations,
          target_countries,
          resume_text,
          resume_url
        })
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    }
    
    return res.status(200).json({
      message: 'Profile saved successfully',
      profile: result
    });
    
  } catch (error) {
    console.error('Upsert profile error:', error);
    return res.status(500).json({ 
      error: 'Failed to save profile', 
      message: error.message 
    });
  }
}

async function updateProfile(req, res) {
  try {
    const updates = req.body;
    
    // Get existing profile
    const { data: existing, error: fetchError } = await supabase
      .from('user_profile')
      .select('*')
      .limit(1)
      .single();
    
    if (fetchError) {
      return res.status(404).json({
        error: 'Profile not found',
        message: 'Create a profile first using POST'
      });
    }
    
    // Update profile
    const { data, error } = await supabase
      .from('user_profile')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
      .select()
      .single();
    
    if (error) throw error;
    
    return res.status(200).json({
      message: 'Profile updated successfully',
      profile: data
    });
    
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ 
      error: 'Failed to update profile', 
      message: error.message 
    });
  }
}
