// Availability poll (/<slug>/ page only): a week sheet of 30-minute blocks.
//
// Columns are the days of one week, rows are half-hours between the configured
// hours; ‹ › pages through the weeks of the from..to range. Dragging paints the
// rectangle between where you pressed and where you are (like when2meet).
//
// A block is identified by "<day>:<slot>" — day = offset from `from`, slot =
// half-hour index from midnight (0..47), so stored answers survive a change to
// the visible hours.
//
// Two ways an answer travels back, picked by `endpoint` in content/availability.json:
//   - endpoint set   -> POST JSON { name, note, from, slots: { "YYYY-MM-DD": [slot, ...] } }
//                       (server/api/responses.js); `?results` fetches and renders
//                       everyone's answers from the same URL.
//   - endpoint empty -> the answer is packed into a share link (?r=<code>) the friend
//                       copies and sends back; opening a link with one or more `r`
//                       params shows the merged results instead of the form.
// If the endpoint is set but unreachable, submit falls back to the share link.
(() => {
  const root = document.querySelector('.avail');
  if (!root) return;

  const { from, to, endpoint, email } = root.dataset;
  const MS_DAY = 864e5;
  const SLOT_MIN = 30;
  const SLOTS_IN_DAY = 48;

  const parse = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d); // local midnight, no UTC shift
  };
  const iso = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const toMinutes = (hm) => {
    const [h, m] = hm.split(':').map(Number);
    return h * 60 + m;
  };

  const start = parse(from);
  const end = parse(to);
  const total = Math.round((end - start) / MS_DAY) + 1;
  const dayIndex = (d) => Math.round((d - start) / MS_DAY);
  const dateAt = (i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const weekStartOf = (d) => addDays(d, -d.getDay());

  const firstSlot = Math.floor(toMinutes(root.dataset.hoursFrom || '09:00') / SLOT_MIN);
  const lastSlot = Math.ceil(toMinutes(root.dataset.hoursTo || '22:00') / SLOT_MIN); // exclusive
  const rows = Math.max(1, Math.min(SLOTS_IN_DAY, lastSlot) - firstSlot);

  const key = (day, slot) => `${day}:${slot}`;
  const unkey = (k) => k.split(':').map(Number);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const isPast = (day, slot) => {
    const d = dateAt(day);
    return d < today || (d.getTime() === today.getTime() && slot * SLOT_MIN < nowMinutes);
  };

  const fmtDay = new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' });
  const fmtWeekday = new Intl.DateTimeFormat('en', { weekday: 'short' });
  const fmtMonthDay = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' });
  const fmtHour = new Intl.DateTimeFormat('en', { hour: 'numeric' });
  const fmtTime = new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' });
  const timeOf = (slot) => new Date(2000, 0, 1, 0, slot * SLOT_MIN);
  const range = (day, s0, s1) =>
    `${fmtDay.format(dateAt(day))}, ${fmtTime.format(timeOf(s0))}–${fmtTime.format(timeOf(s1 + 1))}`;

  const summary = root.querySelector('.avail-summary');
  const nav = root.querySelector('.avail-nav');
  const weekLabel = root.querySelector('.avail-week');
  const prevBtn = root.querySelector('.avail-prev');
  const nextBtn = root.querySelector('.avail-next');
  const sheet = root.querySelector('.avail-sheet');
  const hint = root.querySelector('.avail-hint');
  const detail = root.querySelector('.avail-detail');
  const form = root.querySelector('.avail-form');
  const share = root.querySelector('.avail-share');

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const ARROW =
    '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 12h13M13 6.5 18.5 12 13 17.5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" /></svg>';
  const arrowLink = (text, href) => {
    const a = el('a', 'arrow-link', text);
    a.href = href;
    a.insertAdjacentHTML('beforeend', ARROW);
    return a;
  };

  /* ---------- week sheet ---------- */

  const firstWeek = weekStartOf(start);
  const lastWeek = weekStartOf(end);
  let week = weekStartOf(today < start ? start : today);
  if (week > lastWeek) week = lastWeek;
  if (week < firstWeek) week = firstWeek;

  // Builds the grid for the current week. `decorate(btn, day, slot)` lets each
  // mode paint its own state onto a pickable cell. Returns Map<key, button>.
  function renderWeek({ disablePast, decorate }) {
    const cells = new Map();
    sheet.textContent = '';
    const grid = el('div', 'avail-grid');

    const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
    const first = days[0];
    const last = days[6];
    weekLabel.textContent =
      first.getMonth() === last.getMonth()
        ? `${fmtMonthDay.format(first)} – ${last.getDate()}`
        : `${fmtMonthDay.format(first)} – ${fmtMonthDay.format(last)}`;
    prevBtn.disabled = week <= firstWeek;
    nextBtn.disabled = week >= lastWeek;

    grid.append(el('div', 'avail-corner'));
    for (const d of days) {
      const head = el('div', 'avail-head');
      head.append(el('span', 'avail-head-day', fmtWeekday.format(d)), el('span', 'avail-head-date', String(d.getDate())));
      const idx = dayIndex(d);
      if (idx < 0 || idx >= total) head.classList.add('out');
      if (d.getTime() === today.getTime()) head.classList.add('today');
      grid.append(head);
    }

    for (let r = 0; r < rows; r++) {
      const slot = firstSlot + r;
      const onHour = slot % 2 === 0;
      grid.append(el('div', `avail-time${onHour ? ' hour' : ''}`, onHour ? fmtHour.format(timeOf(slot)) : ''));
      days.forEach((d, col) => {
        const day = dayIndex(d);
        const btn = el('button', `slot${onHour ? ' hour' : ''}`);
        btn.type = 'button';
        btn.tabIndex = -1;
        const inRange = day >= 0 && day < total;
        if (!inRange || (disablePast && isPast(day, slot))) {
          btn.disabled = true;
          btn.classList.add('out');
        } else {
          const k = key(day, slot);
          btn.dataset.key = k;
          btn.dataset.col = col;
          btn.dataset.row = r;
          btn.setAttribute('aria-label', range(day, slot, slot));
          cells.set(k, btn);
          decorate && decorate(btn, day, slot);
        }
        grid.append(btn);
      });
    }
    // roving tabindex: one entry point into the sheet, arrows do the rest
    const firstCell = cells.values().next().value;
    if (firstCell) firstCell.tabIndex = 0;
    sheet.append(grid);
    return cells;
  }

  // arrow keys between cells; Space/Enter is handled by each mode
  sheet.addEventListener('keydown', (e) => {
    const btn = e.target.closest('.slot[data-key]');
    if (!btn) return;
    const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    const col = +btn.dataset.col + move[0];
    const row = +btn.dataset.row + move[1];
    const next = sheet.querySelector(`.slot[data-col="${col}"][data-row="${row}"]`);
    if (!next) return;
    btn.tabIndex = -1;
    next.tabIndex = 0;
    next.focus();
  });

  /* ---------- share-link codec ---------- */

  // Keys -> [[day, firstSlot, lastSlot], ...] with consecutive slots merged.
  const groupRuns = (keys) => {
    const byDay = new Map();
    for (const k of keys) {
      const [d, s] = unkey(k);
      (byDay.get(d) || byDay.set(d, []).get(d)).push(s);
    }
    const runs = [];
    for (const [d, slots] of [...byDay].sort((a, b) => a[0] - b[0])) {
      slots.sort((a, b) => a - b);
      for (let i = 0; i < slots.length; i++) {
        let j = i;
        while (j + 1 < slots.length && slots[j + 1] === slots[j] + 1) j++;
        runs.push([d, slots[i], slots[j]]);
        i = j;
      }
    }
    return runs;
  };
  // "day:a-b,c;day:..." keeps a two-month selection a short URL
  const packSlots = (keys) => {
    const byDay = new Map();
    for (const [d, a, b] of groupRuns(keys)) {
      (byDay.get(d) || byDay.set(d, []).get(d)).push(a === b ? String(a) : `${a}-${b}`);
    }
    return [...byDay].map(([d, parts]) => `${d}:${parts.join(',')}`).join(';');
  };
  const validSlot = (d, s) =>
    Number.isInteger(d) && Number.isInteger(s) && d >= 0 && d < total && s >= 0 && s < SLOTS_IN_DAY;
  const unpackSlots = (str) => {
    const out = new Set();
    for (const dayPart of String(str).split(';')) {
      const [dStr, list = ''] = dayPart.split(':');
      const d = Number(dStr);
      for (const part of list.split(',')) {
        const [a, b = a] = part.split('-').map(Number);
        if (!validSlot(d, a) || !Number.isInteger(b)) continue;
        for (let s = a; s <= Math.min(b, SLOTS_IN_DAY - 1); s++) out.add(key(d, s));
      }
    }
    return out;
  };
  const encode = (obj) => {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const decode = (code) => {
    try {
      const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const obj = JSON.parse(new TextDecoder().decode(bytes));
      const name = String(obj.n || '').trim();
      if (!name) return null;
      return { name, note: String(obj.m || '').trim(), slots: unpackSlots(obj.s || '') };
    } catch {
      return null;
    }
  };

  /* ---------- shared bits ---------- */

  const label = form.querySelector('.avail-submit span');
  const status = form.querySelector('.avail-status');
  const say = (text) => {
    status.textContent = text;
  };

  // Same label morph as the newsletter button in script.js
  const morph = (text, revertTo, after = 2400) => {
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
      if (!revertTo) {
        delete label.dataset.busy;
        return;
      }
      setTimeout(() => {
        label.classList.add('morph-out');
        setTimeout(() => {
          swapTo(revertTo);
          delete label.dataset.busy;
        }, 150);
      }, after);
    }, 150);
  };

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  };

  const listNames = (names) =>
    names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;

  /* ---------- results mode (?results with an endpoint, or ?r=code&r=code...) ---------- */

  const params = new URLSearchParams(location.search);
  const codes = params.getAll('r').filter(Boolean);
  const fromServer = !codes.length && Boolean(endpoint) && params.has('results');

  // endpoint mode: one GET, { "YYYY-MM-DD": [slot, ...] } back into keys
  async function loadResponses() {
    const res = await fetch(`${endpoint}?poll=${from}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(res.statusText);
    const { responses } = await res.json();
    return responses.map((r) => {
      const slots = new Set();
      for (const [date, list] of Object.entries(r.slots || {})) {
        const d = dayIndex(parse(date));
        for (const s of list || []) if (validSlot(d, Number(s))) slots.add(key(d, Number(s)));
      }
      return { name: String(r.name || ''), note: String(r.note || ''), slots };
    });
  }

  async function renderResults() {
    root.classList.add('results');
    document.body.classList.add('avail-results');
    form.hidden = true;
    summary.hidden = false;

    let responses;
    if (fromServer) {
      summary.append(el('p', 'muted', 'Loading…'));
      try {
        responses = await loadResponses();
      } catch {
        summary.textContent = '';
        nav.hidden = true;
        summary.append(el('p', 'muted', "Couldn't load the answers. Try again in a moment."));
        summary.append(arrowLink('Pick your times', location.pathname));
        return;
      }
      summary.textContent = '';
    } else {
      responses = codes.map(decode).filter(Boolean);
    }
    // one answer per person, latest wins (the server already does this)
    responses = [...new Map(responses.map((r) => [r.name.toLowerCase(), r])).values()];

    if (!responses.length) {
      nav.hidden = true;
      summary.append(el('p', 'muted', fromServer ? 'No answers yet.' : "That link didn't contain any answers."));
      summary.append(arrowLink('Pick your times', location.pathname));
      return;
    }

    const counts = new Map();
    const who = new Map();
    for (const r of responses) {
      for (const k of r.slots) {
        counts.set(k, (counts.get(k) || 0) + 1);
        (who.get(k) || who.set(k, []).get(k)).push(r.name);
      }
    }
    const max = responses.length;
    hint.textContent = hint.textContent.replace(/Drag to paint.*$/, "Tap a block to see who's free then.");

    // open on the first week that has any answers unless the default week has some
    const weekHas = (w) => [...counts.keys()].some((k) => weekStartOf(dateAt(unkey(k)[0])).getTime() === w.getTime());
    if (counts.size && !weekHas(week)) {
      const firstDay = Math.min(...[...counts.keys()].map((k) => unkey(k)[0]));
      week = weekStartOf(dateAt(firstDay));
    }

    const paint = () =>
      renderWeek({
        disablePast: false,
        decorate(btn, day, slot) {
          const n = counts.get(key(day, slot)) || 0;
          if (!n) return;
          btn.classList.add('has');
          if (n / max > 0.5) btn.classList.add('hi');
          btn.style.setProperty('--n', String(n / max));
          btn.dataset.count = n;
          btn.setAttribute('aria-label', `${range(day, slot, slot)}, ${n} of ${max} free`);
        },
      });
    paint();
    prevBtn.addEventListener('click', () => {
      week = addDays(week, -7);
      paint();
    });
    nextBtn.addEventListener('click', () => {
      week = addDays(week, 7);
      paint();
    });

    // header: who answered, and the stretches that work for the most people
    const names = responses.map((r) => r.name);
    summary.append(el('p', null, `${max} ${max === 1 ? 'answer' : 'answers'} so far: ${listNames(names)}.`));
    if (counts.size) {
      const top = Math.max(...counts.values());
      const topKeys = [...counts].filter(([, n]) => n === top).map(([k]) => k);
      const runs = groupRuns(topKeys).map(([d, a, b]) => range(d, a, b));
      const shown = runs.slice(0, 5).join('; ') + (runs.length > 5 ? '; …' : '');
      summary.append(
        el(
          'p',
          'muted mt-4',
          top === max && max > 1 ? `Everyone can do ${shown}.` : `Best so far (${top} of ${max}): ${shown}.`
        )
      );
    }
    const notes = responses.filter((r) => r.note);
    if (notes.length) {
      const ul = el('ul', 'avail-notes');
      for (const r of notes) {
        const li = el('li', 'muted');
        li.append(el('strong', null, r.name), ` — ${r.note}`);
        ul.append(li);
      }
      summary.append(ul);
    }

    // tap a block to see who's free then
    const showWho = (btn) => {
      const [day, slot] = unkey(btn.dataset.key);
      const free = who.get(btn.dataset.key) || [];
      sheet.querySelectorAll('.slot.active').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      detail.hidden = false;
      detail.textContent = free.length
        ? `${range(day, slot, slot)}: ${listNames(free)} (${free.length} of ${max})`
        : `${range(day, slot, slot)}: nobody yet`;
    };
    sheet.addEventListener('click', (e) => {
      const btn = e.target.closest('.slot[data-key]');
      if (btn) showWho(btn);
    });

    share.hidden = false;
    if (fromServer) {
      share.append(arrowLink('Add or change your times', location.pathname));
      return;
    }

    // merge another friend's link into this view
    const merge = el('form', 'avail-merge');
    const field = el('div', 'avail-field');
    const input = el('input');
    input.placeholder = "Paste a friend's link to add it";
    input.setAttribute('aria-label', "Paste a friend's link to add it");
    field.append(input);
    const btn = el('button', 'avail-submit');
    btn.type = 'submit';
    btn.append(el('span', null, 'Add'));
    merge.append(field, btn);
    merge.addEventListener('submit', (e) => {
      e.preventDefault();
      let extra = [];
      try {
        extra = new URL(input.value.trim(), location.href).searchParams.getAll('r');
      } catch {}
      const fresh = extra.filter((c) => c && !codes.includes(c));
      if (!fresh.length) {
        input.value = '';
        input.placeholder = 'Nothing new in that link';
        return;
      }
      const next = new URLSearchParams();
      for (const c of [...codes, ...fresh]) next.append('r', c);
      location.search = `?${next}`;
    });
    share.append(merge);
    share.append(arrowLink('Add your own times', location.pathname));
  }

  if (codes.length || fromServer) {
    renderResults();
    return;
  }

  /* ---------- form mode ---------- */

  let selected = new Set();
  let cells = new Map();
  const nameInput = form.querySelector('#avail-name');
  const noteInput = form.querySelector('#avail-note');
  const count = form.querySelector('.avail-count');
  const clear = form.querySelector('.avail-clear');
  const storeKey = `avail:${from}:${to}`;

  const paintWeek = () => {
    cells = renderWeek({
      disablePast: true,
      decorate(btn, day, slot) {
        btn.setAttribute('aria-pressed', String(selected.has(key(day, slot))));
      },
    });
  };
  const sync = () => {
    for (const [k, btn] of cells) btn.setAttribute('aria-pressed', String(selected.has(k)));
  };

  const update = () => {
    const n = selected.size;
    if (n) {
      const days = new Set([...selected].map((k) => unkey(k)[0])).size;
      const hours = n / (60 / SLOT_MIN);
      const span = hours < 1 ? `${n * SLOT_MIN} minutes` : `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
      count.textContent = `${span} across ${days} ${days === 1 ? 'day' : 'days'}`;
    } else {
      count.textContent = 'Nothing selected';
    }
    clear.hidden = !n;
    say('');
    try {
      localStorage.setItem(
        storeKey,
        JSON.stringify({ name: nameInput.value, note: noteInput.value, slots: [...selected] })
      );
    } catch {}
  };

  // restore a draft so a refresh doesn't wipe their picks
  try {
    const draft = JSON.parse(localStorage.getItem(storeKey) || 'null');
    if (draft) {
      nameInput.value = draft.name || '';
      noteInput.value = draft.note || '';
      for (const k of draft.slots || []) {
        const [d, s] = unkey(k);
        if (validSlot(d, s) && !isPast(d, s)) selected.add(k);
      }
    }
  } catch {}
  paintWeek();
  update();

  prevBtn.addEventListener('click', () => {
    week = addDays(week, -7);
    paintWeek();
  });
  nextBtn.addEventListener('click', () => {
    week = addDays(week, 7);
    paintWeek();
  });

  // Rectangle painting: the cell you press decides on/off, and dragging applies
  // that to every pickable cell between it and the pointer. elementFromPoint
  // instead of pointerover because a touch pointer is implicitly captured by
  // the cell it started on.
  let drag = null;
  const applyRect = (btn) => {
    const c0 = Math.min(drag.col, +btn.dataset.col);
    const c1 = Math.max(drag.col, +btn.dataset.col);
    const r0 = Math.min(drag.row, +btn.dataset.row);
    const r1 = Math.max(drag.row, +btn.dataset.row);
    selected = new Set(drag.base);
    for (let c = c0; c <= c1; c++) {
      for (let r = r0; r <= r1; r++) {
        const cell = sheet.querySelector(`.slot[data-col="${c}"][data-row="${r}"]`);
        if (!cell) continue;
        drag.paint ? selected.add(cell.dataset.key) : selected.delete(cell.dataset.key);
      }
    }
    sync();
    update();
  };
  sheet.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('.slot[data-key]');
    if (!btn || e.button) return;
    e.preventDefault();
    drag = { paint: !selected.has(btn.dataset.key), col: +btn.dataset.col, row: +btn.dataset.row, base: new Set(selected) };
    applyRect(btn);
  });
  document.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const btn = under && under.closest('.slot[data-key]');
    if (btn) applyRect(btn);
  });
  const stop = () => {
    drag = null;
  };
  document.addEventListener('pointerup', stop);
  document.addEventListener('pointercancel', stop);
  sheet.addEventListener('keydown', (e) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    const btn = e.target.closest('.slot[data-key]');
    if (!btn) return;
    e.preventDefault();
    selected.has(btn.dataset.key) ? selected.delete(btn.dataset.key) : selected.add(btn.dataset.key);
    sync();
    update();
  });

  clear.addEventListener('click', () => {
    selected.clear();
    sync();
    update();
  });
  nameInput.addEventListener('input', update);
  noteInput.addEventListener('input', update);

  const showShare = (link, lead) => {
    share.textContent = '';
    share.hidden = false;
    if (lead) share.append(el('p', 'muted', lead));
    const linkField = el('div', 'avail-field avail-link');
    const linkInput = el('input');
    linkInput.readOnly = true;
    linkInput.value = link;
    linkInput.setAttribute('aria-label', 'Your availability link');
    linkInput.addEventListener('focus', () => linkInput.select());
    linkField.append(linkInput);
    const hint = el('p', 'muted');
    hint.append('Send this link back to me. ');
    if (email) {
      const a = el('a', null, 'Email it');
      a.href = `mailto:${email}?subject=${encodeURIComponent(`${nameInput.value.trim()}'s availability`)}&body=${encodeURIComponent(link)}`;
      hint.append(a, ' or paste it anywhere you already talk to me.');
    } else {
      hint.append('Paste it anywhere you already talk to me.');
    }
    share.append(linkField, hint);
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (label.dataset.busy) return;
    const name = nameInput.value.trim();
    if (!selected.size) {
      say('Pick at least one block first.');
      return;
    }
    const note = noteInput.value.trim();
    const shareLink = () =>
      `${location.origin}${location.pathname}?r=${encode({ n: name, m: note, s: packSlots(selected) })}`;

    if (endpoint) {
      const slots = {};
      for (const k of selected) {
        const [d, s] = unkey(k);
        (slots[iso(dateAt(d))] ||= []).push(s);
      }
      for (const list of Object.values(slots)) list.sort((a, b) => a - b);
      const payload = { name, note, from, slots };
      morph('Sending…');
      let error;
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          let msg = '';
          try {
            msg = (await res.json()).error || '';
          } catch {}
          error = res.status < 500 && msg ? { msg } : { fallback: true };
        }
      } catch {
        error = { fallback: true };
      }
      delete label.dataset.busy;

      if (!error) {
        morph('Sent!', 'Send');
        share.textContent = '';
        share.hidden = false;
        share.append(el('p', 'muted', `Thanks, ${name}. Send again any time to change your times.`));
      } else if (error.msg) {
        morph('Try again', 'Send');
        say(error.msg);
      } else {
        // server unreachable: hand them the link route instead
        morph('Try again', 'Send');
        const link = shareLink();
        showShare(link, "The server didn't answer. Send me this link instead:");
        const copied = await copyText(link);
        say(copied ? 'Link copied.' : '');
        if (!copied) share.querySelector('input').focus();
      }
      return;
    }

    const link = shareLink();
    showShare(link);
    const copied = await copyText(link);
    morph(copied ? 'Copied!' : 'Copy below', 'Copy my link');
    if (!copied) share.querySelector('input').focus();
  });
})();
