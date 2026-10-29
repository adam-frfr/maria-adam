# Wedding Certificate — Adam & Maria 

A minimal keepsake wedding certificate for Adam (`nova.af`) and Maria (`llittleaangel`), featuring live real-time synchronization via Supabase Realtime.

---

## Features

- **Live Real-Time Synchronization (Supabase Realtime):**
  - Signatures sync between devices in real time as you draw.
  - Text edits update instantly across tabs and devices without needing to refresh.
  - Presence indicator displays when both partners are online together.
- **Refined Stationery Aesthetic:**
  - Fine-line vector botanical corner accents and laurel wreath crest.
  - Blind-embossed style stationery seal with monogram (`A & M`) and year.
  - Clean double-hairline frame with natural warm cotton paper tone.
  - Pure, timeless serif typography (`Cormorant Garamond`) without clutter or artificial gradients.
- **Direct Inline Editing:**
  - Tap or click directly on any text on the certificate (names, handles, date, vows) to edit in place.
- **Hand-Drawn Signatures:**
  - High-DPI canvas signature pads with smooth handwriting curve interpolation.
  - Works with touchscreen, finger, stylus/iPad, or mouse.
- **High-Res Export & Share:**
  - Save as a crisp 300 DPI PNG image.
  - Print / save as landscape vector PDF.
  - Copy shareable link with URL hash encoding.

---

## Deploy on Vercel

1. Push this repository to GitHub.
2. Import the repository into [Vercel](https://vercel.com/).
3. Framework Preset: **Other** (Static Site). No build command needed.
4. Set your private passcode in Vercel:
   - Go to **Project Settings** -> **Environment Variables**.
   - Key: `CERTIFICATE_PIN`
   - Value: `your_secret_passcode` (e.g. any PIN or password you choose).
   - Environments: Production, Preview, Development.
   - Click **Save**.
5. Deploy and share the live URL!

---

## Permanent Keepsake & Offline Resilience

- **Zero-Downtime Digital Proof:** Both Adam & Maria's pristine signatures, vows, and dates are baked into the certificate baseline. Even if Supabase pauses or sleeps due to free-tier inactivity, the certificate displays immediately with 100% fidelity.
- **Secure Serverless Validation:** The passcode is validated securely through Vercel's serverless backend (`/api/verify-pin`), meaning the password is never exposed in browser source code or network bundles.
- **Export Anywhere:** High-resolution horizontal PNG download and landscape PDF printing remain fully functional on all devices at all times.

