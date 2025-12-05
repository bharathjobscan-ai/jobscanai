import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const INCREMENT_SECRET = process.env.INCREMENT_SECRET || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
  const token = req.headers['x-service-token'] || '';
  if (!INCREMENT_SECRET || token !== INCREMENT_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    const { data: existing } = await supabase
      .from('counter')
      .select('count_value')
      .eq('id', 1)
      .single();

    const current = Number(existing?.count_value ?? 0);
    const next = current + 1;

    await supabase
      .from('counter')
      .update({ count_value: next, updated_at: new Date().toISOString() })
      .eq('id', 1);

    return res.status(200).json({ message: 'incremented', count: next });
  } catch (err) {
    return res.status(500).json({ error: 'unknown' });
  }
}
