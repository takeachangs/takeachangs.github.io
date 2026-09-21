// Meet: a group scheduler (/meet/). Each person paints when they're free; the
// page shows the overlap. Two storage modes, picked at boot:
//
// - Store mode (when content/site.json sets meet.supabaseUrl/AnonKey): the
//   event and every answer live in two Supabase tables (supabase/meet.sql),
//   reached through PostgREST with plain fetch. The link is /meet/#<12-char id>
//   and everyone who opens it sees the same thing; the page re-syncs while open.
// - Link mode (no store configured): the event and every answer are base64url
//   JSON in the URL hash, so a saved answer changes the link and the newest link
//   must be passed on. Responses this browser has seen are remembered in
//   localStorage and merged back in, so whoever collects links holds the union.

(() => {
  const root = document.querySelector('.meet');
  const app = document.querySelector('.meet-app');
  const intro = document.querySelector('.meet-intro');
  if (!root || !app) return;

  const STORE = root.dataset.storeUrl && root.dataset.storeKey
    ? { url: root.dataset.storeUrl.replace(/\/+$/, ''), key: root.dataset.storeKey }
    : null;
  const ID_RE = /^[A-Za-z0-9]{12}$/;
  const SYNC_MS = 15000;

  /* ---------- helpers ---------- */

  const $ = (sel, el = app) => el.querySelector(sel);
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const key = (n) => n.trim().toLowerCase();
  const same = (a, b) => key(a) === key(b);
  const local = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode etc. */ } },
  };

  const localDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
  const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const fmtDate = (iso, opts) => new Intl.DateTimeFormat('en-US', opts).format(localDate(iso));
  const fmtHour = (h) => `${h % 12 || 12} ${h % 24 < 12 ? 'AM' : 'PM'}`;
  const fmtTime = (h, half) => `${h % 12 || 12}:${half ? '30' : '00'} ${h % 24 < 12 ? 'AM' : 'PM'}`;
  const timeZone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ''; } };

  const CHEV_L = '<svg viewBox="0 0 16 16" fill="none"><path d="m10 3-5 5 5 5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const CHEV_R = '<svg viewBox="0 0 16 16" fill="none"><path d="m6 3 5 5-5 5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ARROW = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 12h13M13 6.5 18.5 12 13 17.5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" /></svg>';

  // Label morph, same choreography as the newsletter button in script.js.
  const morph = (label, text, revert, after = 2000) => {
    if (label.dataset.busy) return;
    label.dataset.busy = '1';
    const swapTo = (t) => {
      label.textContent = t;
      label.classList.remove('morph-out');
      label.classList.add('morph-in');
      void label.offsetHeight; // flush so morph-in registers as the transition start state
      label.classList.remove('morph-in');
    };
    label.classList.add('morph-out');
    setTimeout(() => {
      swapTo(text);
      setTimeout(() => {
        label.classList.add('morph-out');
        setTimeout(() => { swapTo(revert); delete label.dataset.busy; }, 150);
      }, after);
    }, 150);
  };

  /* ---------- encoding ---------- */
  // Event shape everywhere in this file: { v, t: title, d: [YYYY-MM-DD], s: startHour,
  // e: endHour, z: timezone, r: [{ n: name, a: base64url bitmask of slots, t: saved-at }] }.
  // Slot i = dayIndex * slotsPerDay + halfHourIndex. In link mode the hash is base64url(JSON) of it.

  const b64u = (bytes) => {
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const unb64u = (str) => {
    const s = atob(str.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(str.length / 4) * 4, '='));
    return Uint8Array.from(s, (c) => c.charCodeAt(0));
  };
  const packBits = (bits) => {
    const out = new Uint8Array(Math.ceil(bits.length / 8));
    bits.forEach((b, i) => { if (b) out[i >> 3] |= 1 << (i & 7); });
    return b64u(out);
  };
  const unpackBits = (str, n) => {
    let bytes;
    try { bytes = unb64u(str || ''); } catch { bytes = new Uint8Array(0); }
    return Array.from({ length: n }, (_, i) => !!(bytes[i >> 3] & (1 << (i & 7))));
  };

  const validEvent = (e) => e && Array.isArray(e.d) && e.d.length && e.d.length <= 62 && e.d.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    && Number.isInteger(e.s) && Number.isInteger(e.e) && e.s >= 0 && e.e <= 24 && e.e > e.s;
  const cleanResponses = (r) => (Array.isArray(r) ? r.filter((x) => x && typeof x.n === 'string' && x.n.trim() && typeof x.a === 'string' && x.a) : []);

  const encodeState = (e) => b64u(new TextEncoder().encode(JSON.stringify(e)));
  const decodeState = (hash) => {
    try {
      const e = JSON.parse(new TextDecoder().decode(unb64u(hash)));
      if (!(e && e.v === 1 && validEvent(e))) return null;
      e.t = typeof e.t === 'string' ? e.t.slice(0, 80) : '';
      e.z = typeof e.z === 'string' ? e.z : '';
      e.r = cleanResponses(e.r);
      return e;
    } catch { return null; }
  };

  // Stable id for a link-mode event definition (not its responses) — the localStorage key.
  const eventId = (e) => {
    let h = 5381;
    for (const ch of JSON.stringify([e.t, e.d, e.s, e.e])) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0;
    return h.toString(36);
  };

  // Newest answer per person wins.
  const mergeResponses = (...lists) => {
    const byName = new Map();
    for (const r of lists.flat()) {
      const k = key(r.n);
      if (!byName.has(k) || (r.t || 0) > (byName.get(k).t || 0)) byName.set(k, r);
    }
    return [...byName.values()].sort((a, b) => (a.t || 0) - (b.t || 0));
  };

  /* ---------- store (Supabase via PostgREST) ---------- */

  const api = async (path, { method = 'GET', body, prefer } = {}) => {
    const headers = { apikey: STORE.key, Authorization: `Bearer ${STORE.key}`, Accept: 'application/json' };
    if (body) headers['Content-Type'] = 'application/json';
    if (prefer) headers.Prefer = prefer;
    const res = await fetch(`${STORE.url}/rest/v1/${path}`, { method, headers, body: body && JSON.stringify(body), keepalive: method !== 'GET' });
    if (!res.ok) throw new Error(`store ${res.status}`);
    const text = await res.text(); // return=minimal answers 201 with an empty body
    return text ? JSON.parse(text) : null;
  };

  const newId = () => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => alphabet[b % alphabet.length]).join('');
  };

  const rowsToResponses = (rows) => cleanResponses(rows.map((r) => ({ n: r.name, a: r.bits, t: Date.parse(r.updated_at) || 0 })));

  const storeCreate = async (e) => {
    const sid = newId();
    await api('meet_events', { method: 'POST', prefer: 'return=minimal', body: { id: sid, title: e.t, days: e.d, start_hour: e.s, end_hour: e.e, tz: e.z } });
    return sid;
  };

  const storeLoad = async (sid) => {
    const [events, rows] = await Promise.all([
      api(`meet_events?id=eq.${sid}&select=title,days,start_hour,end_hour,tz`),
      storeResponses(sid),
    ]);
    const row = events[0];
    if (!row) return null;
    const e = { v: 1, t: String(row.title || '').slice(0, 80), d: row.days, s: row.start_hour, e: row.end_hour, z: String(row.tz || ''), r: rows };
    return validEvent(e) ? e : null;
  };

  const storeResponses = async (sid) => rowsToResponses(await api(`meet_responses?event_id=eq.${sid}&select=name,bits,updated_at&order=updated_at`));

  // Upsert one person's answer; empty bits mean "cleared".
  const storeSave = (sid, name, bits) => api('meet_responses?on_conflict=event_id,name_key', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: { event_id: sid, name_key: key(name), name: name.trim(), bits },
  });

  /* ---------- state ---------- */

  let ev = null;                              // decoded event
  let id = '';                                // link mode: eventId(ev); store mode: the 12-char id
  let storeId = '';                           // set in store mode
  let spd = 0, total = 0;                     // slots per day, total slots
  const mine = { name: '', saved: '', bits: [] };
  let mode = 'edit';                          // 'edit' | 'group'
  let focusName = '';                         // group view filtered to one person
  let cells = [];
  let dragging = false;
  let pending = null;                         // store mode: { [name_key]: { name, bits } } waiting to be written
  let saveTimer = 0, syncTimer = 0, saving = false;

  const others = () => ev.r.filter((r) => !(mine.saved && same(r.n, mine.saved)) && !(mine.name.trim() && same(r.n, mine.name)));

  // Write my answer into the event and wherever it lives (URL + localStorage, or the store).
  function persist() {
    const name = mine.name.trim();
    const any = mine.bits.some(Boolean);
    const packed = packBits(mine.bits);
    const current = mine.saved && ev.r.find((r) => r.n === name && r.a === packed);
    if (!current) { // changed: drop the old entry (under either name) and append the new one
      ev.r = others();
      if (name && any) ev.r.push({ n: name, a: packed, t: Date.now() });
      if (storeId) {
        pending = pending || {};
        if (mine.saved && !same(mine.saved, name)) pending[key(mine.saved)] = { name: mine.saved, bits: '' }; // renamed: clear the old row
        if (name) pending[key(name)] = { name, bits: any ? packed : '' };
        queueSave();
      }
    }
    mine.saved = name && any ? name : '';
    if (storeId) {
      local.set('meet:' + storeId, { me: name });
    } else {
      history.replaceState(null, '', '#' + encodeState(ev));
      local.set('meet:' + id, { r: ev.r, me: name });
    }
    if (name) local.set('meet:name', name);
  }

  // Store writes are debounced (typing a name fires persist per keystroke) and retried on the next sync.
  function queueSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 400);
  }

  async function flush() {
    if (!storeId || !pending || saving) return;
    const batch = pending;
    pending = null;
    saving = true;
    try {
      for (const { name, bits } of Object.values(batch)) await storeSave(storeId, name, bits);
      setStatus('');
    } catch {
      pending = { ...batch, ...(pending || {}) }; // newer edits win over the failed batch
      setStatus('Couldn’t save your answer. Retrying…');
    } finally {
      saving = false;
      if (pending) queueSave(); // edits that arrived mid-flight
    }
  }

  // Store mode: pull everyone else's answers while the tab is open.
  async function sync() {
    if (!storeId || document.hidden || dragging) return;
    let rows;
    try { rows = await storeResponses(storeId); } catch { return; }
    if (pending) flush();
    const me = mine.saved ? [ev.r.find((r) => same(r.n, mine.saved))].filter(Boolean) : [];
    const next = [...rows.filter((r) => !me.some((m) => same(m.n, r.n))), ...me];
    if (JSON.stringify(next) !== JSON.stringify(ev.r)) { ev.r = next; refresh(); }
  }

  function setStatus(text) {
    const el = $('.meet-status');
    if (el) el.textContent = text;
  }

  /* ---------- create view ---------- */

  const hourOptions = (from, to, selected) => {
    let html = '';
    for (let h = from; h <= to; h++) html += `<option value="${h}"${h === selected ? ' selected' : ''}>${fmtHour(h)}</option>`;
    return html;
  };

  function renderCreate() {
    intro.hidden = false;
    document.title = 'Meet';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let month = new Date(today.getFullYear(), today.getMonth(), 1);
    let picked = new Set();
    let drag = null;

    app.innerHTML = `
      <form class="meet-create">
        <label class="meet-label" for="meet-title">Title</label>
        <input id="meet-title" class="meet-field" placeholder="What are we meeting about?" maxlength="80" autocomplete="off" />
        <span class="meet-label" id="meet-days-label">Days</span>
        <div class="meet-cal">
          <div class="meet-cal-head">
            <button type="button" class="meet-cal-nav" data-nav="-1" aria-label="Previous month">${CHEV_L}</button>
            <span class="meet-cal-month" aria-live="polite"></span>
            <button type="button" class="meet-cal-nav" data-nav="1" aria-label="Next month">${CHEV_R}</button>
          </div>
          <div class="meet-cal-grid" aria-labelledby="meet-days-label"></div>
        </div>
        <span class="meet-label">Hours</span>
        <div class="meet-hours">
          <select class="meet-field" id="meet-start" aria-label="From">${hourOptions(0, 23, 9)}</select>
          <span class="muted">to</span>
          <select class="meet-field" id="meet-end" aria-label="To">${hourOptions(1, 24, 17)}</select>
        </div>
        <button type="submit" class="meet-btn-primary" disabled><span>Create event</span></button>
        <p class="muted meet-status" aria-live="polite"></p>
      </form>`;

    const form = $('.meet-create');
    const cal = $('.meet-cal-grid');
    const submit = $('.meet-btn-primary');
    const start = $('#meet-start');
    const end = $('#meet-end');
    let creating = false;

    const drawCal = () => {
      $('.meet-cal-month').textContent = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const y = month.getFullYear(), m = month.getMonth();
      const days = new Date(y, m + 1, 0).getDate();
      let html = ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => `<span class="meet-cal-dow" aria-hidden="true">${d}</span>`).join('');
      for (let d = 1; d <= days; d++) {
        const date = new Date(y, m, d);
        const iso = isoDate(date);
        const cls = `meet-cal-day${picked.has(iso) ? ' on' : ''}${+date === +today ? ' today' : ''}`;
        html += `<button type="button" class="${cls}" data-date="${iso}"${d === 1 ? ` style="grid-column-start:${date.getDay() + 1}"` : ''}${date < today ? ' disabled' : ''} aria-pressed="${picked.has(iso)}" aria-label="${fmtDate(iso, { weekday: 'long', month: 'long', day: 'numeric' })}">${d}</button>`;
      }
      cal.innerHTML = html;
      submit.disabled = picked.size === 0 || creating;
    };

    // Toggle every selectable day between two dates (inclusive), in drag mode.
    const applyRange = (from, to) => {
      const [a, b] = [from, to].sort();
      picked = new Set(drag.snapshot);
      for (let d = localDate(a); isoDate(d) <= b; d.setDate(d.getDate() + 1)) {
        if (d < today) continue;
        if (drag.mode) picked.add(isoDate(d)); else picked.delete(isoDate(d));
      }
      drawCal();
    };

    $('.meet-cal-head').addEventListener('click', (e) => {
      const nav = e.target.closest('[data-nav]');
      if (!nav) return;
      month = new Date(month.getFullYear(), month.getMonth() + Number(nav.dataset.nav), 1);
      drawCal();
    });

    cal.addEventListener('pointerdown', (e) => {
      const day = e.target.closest('.meet-cal-day:not(:disabled)');
      if (!day || (e.pointerType === 'mouse' && e.button !== 0)) return;
      e.preventDefault();
      cal.setPointerCapture(e.pointerId);
      drag = { anchor: day.dataset.date, mode: !picked.has(day.dataset.date), snapshot: new Set(picked) };
      applyRange(drag.anchor, drag.anchor);
    });
    cal.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const day = document.elementFromPoint(e.clientX, e.clientY)?.closest('.meet-cal-day');
      if (day) applyRange(drag.anchor, day.dataset.date);
    });
    const endDrag = () => { drag = null; };
    cal.addEventListener('pointerup', endDrag);
    cal.addEventListener('pointercancel', endDrag);
    cal.addEventListener('click', (e) => { // keyboard activation only; pointer clicks are handled above
      const day = e.target.closest('.meet-cal-day:not(:disabled)');
      if (!day || e.detail !== 0) return;
      picked.has(day.dataset.date) ? picked.delete(day.dataset.date) : picked.add(day.dataset.date);
      drawCal();
      cal.querySelector(`[data-date="${day.dataset.date}"]`).focus();
    });

    start.addEventListener('change', () => { if (+end.value <= +start.value) end.value = +start.value + 1; });
    end.addEventListener('change', () => { if (+end.value <= +start.value) start.value = +end.value - 1; });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!picked.size || creating) return;
      const event = { v: 1, t: $('#meet-title').value.trim(), d: [...picked].sort(), s: +start.value, e: +end.value, z: timeZone(), r: [] };
      if (!STORE) { location.hash = encodeState(event); return; } // hashchange → boot() renders the event
      creating = true;
      submit.disabled = true;
      setStatus('');
      try {
        location.hash = await storeCreate(event);
      } catch {
        setStatus('Couldn’t reach the store. Check your connection and try again.');
        creating = false;
        submit.disabled = false;
      }
    });

    drawCal();
  }

  function renderError(text) {
    intro.hidden = false;
    document.title = 'Meet';
    app.innerHTML = `
      <p class="muted meet-status">${esc(text)}</p>
      <button type="button" class="meet-btn-primary meet-retry"><span>Try again</span></button>
      <a class="arrow-link meet-new" href="/meet/">New event${ARROW}</a>`;
    $('.meet-retry').addEventListener('click', boot);
  }

  /* ---------- event view ---------- */

  const slotOf = (i) => ({ day: ev.d[Math.floor(i / spd)], r: i % spd });
  const slotTime = (r) => fmtTime(ev.s + Math.floor(r / 2), r % 2);
  const whenLabel = (i) => {
    const { day, r } = slotOf(i);
    return `${fmtDate(day, { weekday: 'short', month: 'short', day: 'numeric' })}, ${slotTime(r)} – ${slotTime(r + 1)}`;
  };

  const meta = () => {
    const first = ev.d[0], last = ev.d[ev.d.length - 1];
    const span = Math.round((localDate(last) - localDate(first)) / 864e5) + 1;
    let range = fmtDate(first, { month: 'short', day: 'numeric' });
    if (last !== first) {
      const sameMonth = first.slice(0, 7) === last.slice(0, 7);
      range += ` – ${fmtDate(last, sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' })}`;
    }
    if (ev.d.length > 1 && span !== ev.d.length) range = `${ev.d.length} days, ${range}`;
    const tz = ev.z ? ` · Times in ${ev.z.replace(/_/g, ' ')}` : '';
    const here = timeZone();
    const warn = ev.z && here && here !== ev.z ? ` <span class="meet-dim">(you're in ${here.replace(/_/g, ' ')})</span>` : '';
    return `${esc(range)} · ${fmtHour(ev.s)} – ${fmtHour(ev.e)}${esc(tz)}${warn}`;
  };

  function renderEvent() {
    intro.hidden = true;
    document.title = ev.t ? `${ev.t} · Meet` : 'Meet';

    app.innerHTML = `
      <div class="meet-head">
        <span class="section-label">${esc(ev.t || 'Untitled meeting')}</span>
        <p class="muted meet-meta">${meta()}</p>
      </div>
      <div class="meet-bar">
        <input class="meet-field meet-name" placeholder="Your name" maxlength="40" autocomplete="off" value="${esc(mine.name)}" aria-label="Your name" />
        <div class="meet-seg" role="tablist" aria-label="View">
          <button type="button" role="tab" data-mode="edit">You</button>
          <button type="button" role="tab" data-mode="group">Everyone<span class="meet-count"></span></button>
        </div>
      </div>
      <div class="meet-card"><div class="meet-scroll"><div class="meet-grid" role="grid"></div></div></div>
      <p class="muted meet-detail" aria-live="polite"></p>
      <div class="meet-share">
        <input readonly aria-label="Event link" />
        <button type="button"><span>Copy link</span></button>
      </div>
      <p class="muted meet-note"></p>
      <p class="muted meet-status" aria-live="polite"></p>
      <div class="meet-block meet-best-block">
        <span class="meet-label">Best times</span>
        <ul class="meet-best"></ul>
      </div>
      <div class="meet-block">
        <span class="meet-label">Responses</span>
        <div class="meet-people"></div>
      </div>
      <a class="arrow-link meet-new" href="/meet/">New event${ARROW}</a>`;

    buildGrid();
    wire();
    setMode('edit');
    refresh();
  }

  function buildGrid() {
    const g = $('.meet-grid');
    g.style.setProperty('--n', ev.d.length);
    g.style.setProperty('--rows', spd);
    let html = '';
    ev.d.forEach((iso, c) => {
      html += `<span class="meet-day" style="grid-column:${c + 2}" role="columnheader"><span class="muted">${fmtDate(iso, { weekday: 'short' })}</span><span>${fmtDate(iso, { day: 'numeric' })}</span></span>`;
    });
    for (let r = 0; r < spd; r += 2) html += `<span class="meet-time" style="grid-row:${r + 2}" aria-hidden="true">${fmtHour(ev.s + r / 2)}</span>`;
    ev.d.forEach((_, c) => {
      for (let r = 0; r < spd; r++) {
        const i = c * spd + r;
        const cls = `meet-cell${r % 2 ? ' half' : ''}${c === ev.d.length - 1 ? ' last-col' : ''}${r === spd - 1 ? ' last-row' : ''}`;
        html += `<button type="button" class="${cls}" style="grid-column:${c + 2};grid-row:${r + 2}" data-i="${i}" role="gridcell"></button>`;
      }
    });
    g.innerHTML = html;
    cells = [...g.querySelectorAll('.meet-cell')];
  }

  function wire() {
    const g = $('.meet-grid');
    const name = $('.meet-name');
    let drag = null;

    // Paint a rectangle from the anchor cell to the current one, on top of the pre-drag snapshot.
    const applyDrag = (i) => {
      const [c1, r1] = [Math.floor(drag.anchor / spd), drag.anchor % spd];
      const [c2, r2] = [Math.floor(i / spd), i % spd];
      mine.bits = drag.snapshot.slice();
      for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++)
        for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) mine.bits[c * spd + r] = drag.mode;
      paint();
    };

    g.addEventListener('pointerdown', (e) => {
      const cell = e.target.closest('.meet-cell');
      if (!cell || mode !== 'edit' || (e.pointerType === 'mouse' && e.button !== 0)) return;
      e.preventDefault();
      g.setPointerCapture(e.pointerId);
      const i = +cell.dataset.i;
      drag = { anchor: i, mode: !mine.bits[i], snapshot: mine.bits.slice() };
      dragging = true;
      applyDrag(i);
    });
    g.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const cell = document.elementFromPoint(e.clientX, e.clientY)?.closest('.meet-cell');
      if (cell) applyDrag(+cell.dataset.i);
    });
    const endDrag = () => {
      if (!drag) return;
      drag = null;
      dragging = false;
      persist();
      refresh();
    };
    g.addEventListener('pointerup', endDrag);
    g.addEventListener('pointercancel', endDrag);

    g.addEventListener('click', (e) => { // keyboard activation only (pointer paints above)
      const cell = e.target.closest('.meet-cell');
      if (!cell || e.detail !== 0) return;
      const i = +cell.dataset.i;
      if (mode === 'edit') { mine.bits[i] = !mine.bits[i]; persist(); refresh(); }
      showDetail(i);
    });

    // Group view: hovering or focusing a slot lists who's free then.
    const over = (e) => { const cell = e.target.closest('.meet-cell'); if (cell) showDetail(+cell.dataset.i); };
    g.addEventListener('pointerover', over);
    g.addEventListener('focusin', over);
    g.addEventListener('pointerleave', () => showDetail(-1));

    name.addEventListener('input', () => {
      mine.name = name.value;
      // Same name as an existing answer and nothing painted yet: that's you, back on another device.
      const existing = ev.r.find((r) => mine.name.trim() && same(r.n, mine.name));
      if (existing && !mine.bits.some(Boolean)) { mine.bits = unpackBits(existing.a, total); mine.saved = existing.n; }
      persist();
      refresh();
    });

    $('.meet-seg').addEventListener('click', (e) => {
      const b = e.target.closest('[data-mode]');
      if (b) { focusName = ''; setMode(b.dataset.mode); refresh(); }
    });

    $('.meet-people').addEventListener('click', (e) => {
      const chip = e.target.closest('.meet-chip');
      if (!chip) return;
      focusName = same(focusName, chip.dataset.name) ? '' : chip.dataset.name;
      setMode('group');
      refresh();
    });

    const share = $('.meet-share');
    share.querySelector('button').addEventListener('click', async () => {
      const input = share.querySelector('input');
      const label = share.querySelector('button span');
      try {
        await navigator.clipboard.writeText(location.href);
        morph(label, 'Copied', 'Copy link');
      } catch {
        input.focus();
        input.select();
        morph(label, 'Press ⌘C', 'Copy link');
      }
    });
  }

  function setMode(m) {
    mode = m;
    $('.meet-grid').classList.toggle('editing', m === 'edit');
    for (const b of app.querySelectorAll('.meet-seg [data-mode]')) {
      const on = b.dataset.mode === m;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on);
    }
    showDetail(-1);
  }

  // Everyone's answers, decoded once per refresh.
  let decoded = [];
  const counts = () => {
    const list = focusName ? decoded.filter((r) => same(r.n, focusName)) : decoded;
    const n = new Array(total).fill(0);
    for (const r of list) r.bits.forEach((b, i) => { if (b) n[i]++; });
    return { n, of: list.length };
  };

  function paint() {
    if (mode === 'edit') {
      cells.forEach((c, i) => c.style.setProperty('--p', mine.bits[i] ? '1' : '0'));
      return;
    }
    const { n, of } = counts();
    cells.forEach((c, i) => c.style.setProperty('--p', n[i] ? (0.15 + 0.85 * n[i] / of).toFixed(2) : '0'));
  }

  function labelCells() {
    const { n, of } = counts();
    cells.forEach((c, i) => {
      const state = mode === 'edit' ? (mine.bits[i] ? 'free' : 'not marked') : `${n[i]} of ${of} free`;
      c.setAttribute('aria-label', `${whenLabel(i)}, ${state}`);
      if (mode === 'edit') c.setAttribute('aria-pressed', !!mine.bits[i]);
      else c.removeAttribute('aria-pressed');
    });
  }

  function showDetail(i) {
    const el = $('.meet-detail');
    if (i < 0) {
      el.innerHTML = mode === 'edit'
        ? 'Drag to paint the times you’re free. Drag again to clear.'
        : decoded.length ? 'Hover a slot to see who’s free.' : 'Nobody has answered yet.';
      return;
    }
    if (mode === 'edit') {
      el.innerHTML = `<b>${whenLabel(i)}</b> · ${mine.bits[i] ? 'free' : 'not marked'}`;
      return;
    }
    const yes = decoded.filter((r) => r.bits[i]).map((r) => r.n);
    const no = decoded.filter((r) => !r.bits[i]).map((r) => r.n);
    el.innerHTML = `<b>${whenLabel(i)}</b> · ${yes.length} of ${decoded.length} free`
      + (yes.length ? `: ${esc(yes.join(', '))}` : '')
      + (no.length ? ` <span class="meet-dim">· not ${esc(no.join(', '))}</span>` : '');
  }

  // Up to three longest windows where the most people overlap.
  function bestTimes() {
    if (!decoded.length) return [];
    const { n } = counts();
    const max = Math.max(...n);
    if (!max) return [];
    const runs = [];
    for (let c = 0; c < ev.d.length; c++) {
      let from = -1;
      for (let r = 0; r <= spd; r++) {
        const hit = r < spd && n[c * spd + r] === max;
        if (hit && from < 0) from = r;
        if (!hit && from >= 0) { runs.push({ c, from, to: r }); from = -1; }
      }
    }
    runs.sort((a, b) => (b.to - b.from) - (a.to - a.from) || a.c - b.c || a.from - b.from);
    const of = focusName ? 1 : decoded.length;
    return runs.slice(0, 3).map((run) => ({
      when: `${fmtDate(ev.d[run.c], { weekday: 'short', month: 'short', day: 'numeric' })} · ${slotTime(run.from)} – ${slotTime(run.to)}`,
      who: max === of ? (of === 1 ? (focusName || 'you') : 'everyone') : `${max} of ${of}`,
    }));
  }

  function refresh() {
    decoded = ev.r.map((r) => ({ ...r, bits: unpackBits(r.a, total) }));
    if (focusName && !decoded.some((r) => same(r.n, focusName))) focusName = '';

    $('.meet-count').textContent = decoded.length ? ` · ${decoded.length}` : '';
    $('.meet-share input').value = location.href;

    const name = mine.name.trim();
    const any = mine.bits.some(Boolean);
    $('.meet-note').textContent = !name && any
      ? 'Add your name above to save your answer.'
      : storeId
        ? 'Anyone with this link can add when they’re free. Answers show up for everyone within a few seconds.'
        : name && any
          ? 'Your answer is in this link. Send it on — whoever opens it sees everyone so far.'
          : 'Share this link and everyone can add when they’re free.';

    const best = bestTimes();
    $('.meet-best-block').hidden = !best.length;
    $('.meet-best').innerHTML = best.map((b) => `<li><span>${b.when}</span><span class="meet-dim">${esc(b.who)}</span></li>`).join('');

    $('.meet-people').innerHTML = decoded.length
      ? decoded.map((r) => `<button type="button" class="meet-chip${same(r.n, focusName) ? ' on' : ''}" data-name="${esc(r.n)}" aria-pressed="${same(r.n, focusName)}">${esc(r.n)}</button>`).join('')
      : '<span class="muted">No responses yet.</span>';

    paint();
    labelCells();
    showDetail(-1);
  }

  /* ---------- boot ---------- */

  function startEvent() {
    spd = (ev.e - ev.s) * 2;
    total = ev.d.length * spd;
    const own = mine.name.trim() && ev.r.find((r) => same(r.n, mine.name));
    mine.bits = own ? unpackBits(own.a, total) : new Array(total).fill(false);
    mine.saved = own ? own.n : '';
    focusName = '';
    persist();
    renderEvent();
  }

  async function boot() {
    clearInterval(syncTimer);
    clearTimeout(saveTimer);
    storeId = '';
    pending = null;
    const hash = location.hash.slice(1);

    if (STORE && ID_RE.test(hash)) {
      renderLoading();
      try { ev = await storeLoad(hash); } catch { renderError('Couldn’t load this event. The store may be waking up — try again in a moment.'); return; }
      if (hash !== location.hash.slice(1)) return; // navigated away while loading
      if (!ev) { renderError('This event doesn’t exist, or the link is incomplete.'); return; }
      storeId = id = hash;
      const saved = local.get('meet:' + storeId) || {};
      mine.name = typeof saved.me === 'string' ? saved.me : (local.get('meet:name') || '');
      startEvent();
      syncTimer = setInterval(sync, SYNC_MS);
      return;
    }

    ev = hash ? decodeState(hash) : null;
    if (!ev) {
      if (hash && ID_RE.test(hash)) renderError('This link needs a store this page isn’t configured for.');
      else renderCreate();
      return;
    }
    id = eventId(ev);
    const saved = local.get('meet:' + id) || {};
    ev.r = mergeResponses(ev.r, cleanResponses(saved.r));
    mine.name = typeof saved.me === 'string' ? saved.me : (local.get('meet:name') || '');
    startEvent();
  }

  function renderLoading() {
    intro.hidden = true;
    app.innerHTML = '<p class="muted meet-status">Loading…</p>';
  }

  window.addEventListener('hashchange', boot);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
  window.addEventListener('focus', sync);
  window.addEventListener('pagehide', () => { if (pending) flush(); });
  boot();
})();
