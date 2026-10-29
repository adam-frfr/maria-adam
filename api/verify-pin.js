/**
 * Vercel Serverless Function: Passcode Verification
 * Validates the admin passcode securely on the server without exposing it in frontend code.
 * Passcode is configured in Vercel Project Settings -> Environment Variables as CERTIFICATE_PIN
 */

export default function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = {};
      }
    }
    body = body || {};

    const enteredPin = String(body.pin || '').trim();
    // Prioritize user's environment variable set in Vercel dashboard
    const secretPin = String(
      process.env.CERTIFICATE_PIN ||
      process.env.ADMIN_PIN ||
      '2026'
    ).trim();

    if (enteredPin && enteredPin === secretPin) {
      return res.status(200).json({ ok: true, message: 'Unlocked' });
    }

    return res.status(401).json({ ok: false, error: 'Incorrect passcode' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Server validation error' });
  }
}
