// /api/responses — the availability poll's backend, one Vercel function.
//
//   POST { name, note, from, slots: { "YYYY-MM-DD": [slot, ...] } }
//        slot = half-hour index from midnight (0..47);
//        stores one entry per (poll, name); sending again overwrites.
//   GET  ?poll=YYYY-MM-DD
//        -> { poll, responses: [{ name, note, slots, at }, ...] } oldest first.
//
// A "poll" is keyed by the range's start date, so changing `from` in
// content/availability.json starts a fresh, empty result set.
//
// Deliberately light on protection: the page is unlisted, the free tier
// hard-stops instead of billing, and there is nothing secret to read.
// Origin allowlist + size caps + a per-poll entry cap is the whole story.
import { getStore } from '../lib/store.js';

const DEFAULT_ORIGINS = [
  'https://seongm.in',
  'https://www.seongm.in',
  'https://takeachangs.github.io',
  'http://localhost:4173',
];
const envOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
const ALLOWED = envOrigins.length ? envOrigins : DEFAULT_ORIGINS;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_BODY = 32 * 1024;
const MAX_NAME = 40;
const MAX_NOTE = 200;
const MAX_DAYS = 400;
const SLOTS_IN_DAY = 48;
const MAX_RESPONSES = 200;

const key = (poll) => `avail:${poll}`;
const field = (name) => name.toLowerCase().replace(/\s+/g, ' ');

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

// Vercel pre-parses JSON bodies into req.body; plain Node (dev server) doesn't.
async function readJson(req) {
  if (req.body !== undefined && req.body !== null) {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (JSON.stringify(body).length > MAX_BODY) throw Object.assign(new Error('too large'), { status: 413 });
    return body;
  }
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_BODY) throw Object.assign(new Error('too large'), { status: 413 });
  }
  return raw ? JSON.parse(raw) : {};
}

// Returns { error } or { poll, response }
function validate(body) {
  if (!body || typeof body !== 'object') return { error: 'expected a JSON object' };
  const name = String(body.name ?? '').trim().replace(/\s+/g, ' ');
  if (!name) return { error: 'name is required' };
  if (name.length > MAX_NAME) return { error: `name is longer than ${MAX_NAME} characters` };
  const note = String(body.note ?? '').trim().slice(0, MAX_NOTE);
  const poll = String(body.from ?? '');
  if (!DATE.test(poll)) return { error: 'from must be YYYY-MM-DD' };
  const raw = body.slots;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'slots must be an object of dates' };
  const dates = Object.keys(raw).filter((d) => DATE.test(d) && d >= poll).sort();
  if (dates.length > MAX_DAYS) return { error: 'too many days' };
  const slots = {};
  for (const d of dates) {
    if (!Array.isArray(raw[d])) continue;
    const list = [...new Set(raw[d].map(Number))]
      .filter((s) => Number.isInteger(s) && s >= 0 && s < SLOTS_IN_DAY)
      .sort((a, b) => a - b);
    if (list.length) slots[d] = list;
  }
  if (!Object.keys(slots).length) return { error: 'pick at least one block' };
  return { poll, response: { name, note, slots, at: new Date().toISOString() } };
}

const parseStored = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  if (origin && !ALLOWED.includes(origin)) return send(res, 403, { error: 'origin not allowed' });

  try {
    const store = await getStore();

    if (req.method === 'GET') {
      const poll = new URL(req.url, 'http://localhost').searchParams.get('poll') || '';
      if (!DATE.test(poll)) return send(res, 400, { error: 'poll must be YYYY-MM-DD' });
      const all = (await store.hgetall(key(poll))) || {};
      const responses = Object.values(all)
        .map(parseStored)
        .sort((a, b) => String(a.at).localeCompare(String(b.at)));
      return send(res, 200, { poll, responses });
    }

    if (req.method === 'POST') {
      let body;
      try {
        body = await readJson(req);
      } catch (e) {
        return send(res, e.status || 400, { error: e.status ? 'body too large' : 'invalid JSON' });
      }
      const v = validate(body);
      if (v.error) return send(res, 400, { error: v.error });
      const k = key(v.poll);
      const f = field(v.response.name);
      if (!(await store.hexists(k, f)) && (await store.hlen(k)) >= MAX_RESPONSES) {
        return send(res, 409, { error: 'this poll is full' });
      }
      await store.hset(k, { [f]: JSON.stringify(v.response) });
      return send(res, 200, { ok: true, count: await store.hlen(k) });
    }

    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return send(res, 405, { error: 'method not allowed' });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'server error' });
  }
}
