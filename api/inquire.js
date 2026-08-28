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

function isActivationMessage(message) {
  const text = String(message || '').toLowerCase();
  return text.includes('activat') || text.includes('confirm your email');
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

  const name = fields.name.trim();
  const email = fields.email.trim();
  const params = new URLSearchParams();
  params.set('name', name);
  params.set('email', email);
  params.set('checkin', (fields.checkin || '').trim());
  params.set('checkout', (fields.checkout || '').trim());
  params.set('guests', (fields.guests || '').trim());
  params.set('message', fields.message || '');
  params.set('_subject', 'Costa Medellin inquiry');
  params.set('_replyto', email);
  params.set('_captcha', 'false');
  params.set('_template', 'table');

  let upstream;
  try {
    upstream = await fetch(FORMSUBMIT_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: origin,
        Referer: `${origin}/`,
      },
      body: params.toString(),
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    return json(origin, 502, {
      error: 'Sorry, we could not send your inquiry. Please email costamedellin.ph@gmail.com or try again.',
    });
  }

  const contentType = upstream.headers.get('content-type') || '';
  let data = {};
  if (contentType.includes('application/json')) {
    data = await upstream.json().catch(() => ({}));
  } else {
    await upstream.text().catch(() => '');
    return json(origin, 502, {
      error: 'Sorry, we could not send your inquiry. Please email costamedellin.ph@gmail.com or try again.',
    });
  }

  if (isActivationMessage(data.message)) {
    return json(origin, 200, { ok: true, needsActivation: true });
  }

  const failed =
    !upstream.ok ||
    data.success === false ||
    data.success === 'false';
  if (failed) {
    return json(origin, 502, {
      error: 'Sorry, we could not send your inquiry. Please email costamedellin.ph@gmail.com or try again.',
    });
  }

  return json(origin, 200, { ok: true });
}
