/**
 * Vercel Serverless Function / Cron: Supabase Keep-Alive
 * Automatically pings the Supabase REST API daily so the free-tier database NEVER pauses or sleeps.
 */

export default async function handler(req, res) {
  try {
    const SUPABASE_URL = 'https://yebgxfcezwhdnosxzcot.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllYmd4ZmNlendoZG5vc3h6Y290Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzMDA1NzUsImV4cCI6MjEwODg3NjU3NX0.zO8aKK79qr52oCx_rIiZaUeSO-3G28g-MMkv9on5uys';

    const resp = await fetch(`${SUPABASE_URL}/rest/v1/certificates?select=id&limit=1`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (resp.ok) {
      return res.status(200).json({ ok: true, message: 'Supabase project kept awake successfully' });
    }

    return res.status(500).json({ ok: false, status: resp.status });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
