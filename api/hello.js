/**
 * Hello World API Endpoint
 * 
 * Returns a simple greeting message with an incrementer
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
  try {
    const { data, error } = await supabase
      .from('counter')
      .select('count_value, updated_at')
      .eq('id', 1)
      .limit(1)
      .single();

    if (error) {
      return res.status(500).json({ error: 'db_read_error', details: error.message });
    }

    const n = data?.count_value ?? 0;
    return res.status(200).json({ message: `Hello World ${n}`, count: n });
  } catch (err) {
    return res.status(500).json({ error: 'unknown' });
  }
}
