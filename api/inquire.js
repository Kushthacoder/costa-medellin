const RECIPIENT = 'costamedellin.ph@gmail.com';
const FORMSUBMIT_URL = `https://formsubmit.co/ajax/${encodeURIComponent(RECIPIENT)}`;
const MAX_NAME = 200;
const MAX_EMAIL = 254;
const MAX_MESSAGE = 4000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_FIELDS = ['name', 'email', 'checkin', 'checkout', 'guests', 'message', '_honey'];
const SITE_ORIGINS = new Set([
  'https://costamedellin.com',
  'https://www.costamedellin.com',
]);

function isAllowedOrigin(origin) {
  if (!origin || typeof origin !== 'string') return false;
  if (SITE_ORIGINS.has(origin)) return true;
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

function pickFields(body) {
  const out = {};
  if (!body || typeof body !== 'object') return out;
  for (const key of ALLOWED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
    const value = body[key];
    if (value == null) {
      out[key] = '';
    } else if (typeof value === 'string' || typeof value === 'number') {
      out[key] = String(value);
    } else {
      out[key] = null;
    }
  }
  return out;
}

function validateInquiry(fields) {
  if (fields.name == null || fields.email == null) {
    return 'Please check your details and try again.';
  }
  if (Object.values(fields).some((value) => value === null)) {
    return 'Please check your details and try again.';
  }

  const name = fields.name.trim();
  const email = fields.email.trim();
  const checkin = (fields.checkin || '').trim();
  const checkout = (fields.checkout || '').trim();
  const guests = (fields.guests || '').trim();
  const message = fields.message == null ? '' : String(fields.message);

  if (!name || name.length > MAX_NAME) {
    return 'Please check your details and try again.';
  }
  if (!email || email.length > MAX_EMAIL || !EMAIL_RE.test(email)) {
    return 'Please check your details and try again.';
  }
  if (message.length > MAX_MESSAGE) {
    return 'Please shorten your message and try again.';
  }
  if (checkin && !DATE_RE.test(checkin)) {
    return 'Please check your details and try again.';
  }
  if (checkout && !DATE_RE.test(checkout)) {
    return 'Please check your details and try again.';
  }
  if (guests) {
    if (!/^\d+$/.test(guests)) {
      return 'Please check your details and try again.';
    }
    const n = Number(guests);
    if (n < 1 || n > 11) {
      return 'Please check your details and try again.';
    }
  }

  return null;
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    Vary: 'Origin',
    'Cache-Control': 'no-store',
  };
}

function json(origin, status, payload) {
  console.log('inquire', status);
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
  if (isAllowedOrigin(origin)) {
    Object.assign(headers, corsHeaders(origin));
  }
  return new Response(JSON.stringify(payload), { status, headers });
}

async function parseBody(request) {
  const text = await request.text();
  if (!text) return {};
  return JSON.parse(text);
}

export async function OPTIONS(request) {
  const origin = request.headers.get('origin') || '';
  if (!isAllowedOrigin(origin)) {
    console.log('inquire', 403);
    return new Response(null, { status: 403, headers: { Vary: 'Origin' } });
  }
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(request) {
  const origin = request.headers.get('origin') || '';
  if (!isAllowedOrigin(origin)) {
    return json(origin, 403, { error: 'Forbidden' });
  }

  let body;
  try {
    body = await parseBody(request);
  } catch {
    return json(origin, 400, { error: 'Please check your details and try again.' });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json(origin, 400, { error: 'Please check your details and try again.' });
  }

  const fields = pickFields(body);
  const honey = (fields._honey || '').trim();
  if (honey) {
    return json(origin, 200, { ok: true });
  }

  const error = validateInquiry(fields);
  if (error) {
    return json(origin, 400, { error });
  }

  // Formsubmit's AJAX endpoint is Cloudflare-gated from Vercel/datacenter
  // IPs (verified: function POST returns a challenge HTML page, not JSON).
  // The browser completes the send to this server-provided URL after the gate.
  return json(origin, 200, { ok: true, submitUrl: FORMSUBMIT_URL });
}
