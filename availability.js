// Availability poll (/<slug>/ page only): a month-grid day picker.
//
// Two ways an answer travels back, picked by `endpoint` in content/availability.json:
//   - endpoint set   -> POST JSON { name, note, from, days: ["YYYY-MM-DD", ...] } to it
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
  const parse = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d); // local midnight, no UTC shift
  };
  const iso = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const start = parse(from);
  const end = parse(to);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const total = Math.round((end - start) / MS_DAY) + 1;
  const dayIndex = (d) => Math.round((d - start) / MS_DAY);
  const dateAt = (i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);

  const fmtMonth = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' });
  const fmtDay = new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' });
  const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const months = root.querySelector('.avail-months');
  const summary = root.querySelector('.avail-summary');
  const detail = root.querySelector('.avail-detail');
  const form = root.querySelector('.avail-form');
  const share = root.querySelector('.avail-share');

  const ARROW =
    '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 12h13M13 6.5 18.5 12 13 17.5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" /></svg>';
  const arrowLink = (text, href) => {
    const a = el('a', 'arrow-link', text);
    a.href = href;
    a.insertAdjacentHTML('beforeend', ARROW);
    return a;
  };

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  /* ---------- calendar ---------- */

  // Renders one grid per month spanning from..to. Returns Map<dayIndex, button>
  // for the days that are actually pickable.
  function renderCalendar({ disablePast }) {
    const cells = new Map();
    months.textContent = '';
    for (
      let cur = new Date(start.getFullYear(), start.getMonth(), 1);
      cur <= end;
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
    ) {
      const month = el('section', 'avail-month');
      month.append(el('div', 'avail-month-label', fmtMonth.format(cur)));
      const grid = el('div', 'avail-grid');
      DOW.forEach((d) => grid.append(el('div', 'avail-dow', d)));
      for (let i = 0; i < cur.getDay(); i++) grid.append(el('div', 'avail-pad'));

      const daysInMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(cur.getFullYear(), cur.getMonth(), d);
        const idx = dayIndex(date);
        const btn = el('button', 'day');
        btn.type = 'button';
        btn.append(el('span', null, String(d)));
        if (date.getTime() === today.getTime()) btn.classList.add('today');
        const inRange = idx >= 0 && idx < total;
        if (!inRange || (disablePast && date < today)) {
          btn.disabled = true;
          btn.classList.add('out');
        } else {
          btn.dataset.index = idx;
          btn.setAttribute('aria-label', fmtDay.format(date));
          cells.set(idx, btn);
        }
        grid.append(btn);
      }
      month.append(grid);
      months.append(month);
    }
    return cells;
  }

  /* ---------- share-link codec ---------- */

  // {n, m, d:"3-7,10"} -> base64url. Runs of days are collapsed so a two-month
  // selection stays a short URL.
  const packDays = (days) => {
    const out = [];
    for (let i = 0; i < days.length; i++) {
      let j = i;
      while (j + 1 < days.length && days[j + 1] === days[j] + 1) j++;
      out.push(j > i ? `${days[i]}-${days[j]}` : String(days[i]));
      i = j;
    }
    return out.join(',');
  };
  const unpackDays = (s) => {
    const out = new Set();
    for (const part of String(s).split(',')) {
      const [a, b = a] = part.split('-').map(Number);
      if (!Number.isInteger(a) || !Number.isInteger(b)) continue;
      for (let i = Math.max(0, a); i <= Math.min(b, total - 1); i++) out.add(i);
    }
    return [...out].sort((x, y) => x - y);
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
      return { name, note: String(obj.m || '').trim(), days: unpackDays(obj.d || '') };
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

  /* ---------- results mode (?r=code&r=code...) ---------- */

  const params = new URLSearchParams(location.search);
  const codes = params.getAll('r').filter(Boolean);
  const fromServer = !codes.length && Boolean(endpoint) && params.has('results');

  // endpoint mode: one GET, ISO days back to indices into this range
  async function loadResponses() {
    const res = await fetch(`${endpoint}?poll=${from}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(res.statusText);
    const { responses } = await res.json();
    return responses.map((r) => ({
      name: String(r.name || ''),
      note: String(r.note || ''),
      days: (r.days || [])
        .map((d) => dayIndex(parse(d)))
        .filter((i) => i >= 0 && i < total)
        .sort((a, b) => a - b),
    }));
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
        summary.append(el('p', 'muted', "Couldn't load the answers. Try again in a moment."));
        summary.append(arrowLink('Pick your days', location.pathname));
        return;
      }
      summary.textContent = '';
    } else {
      responses = codes.map(decode).filter(Boolean);
    }
    // one answer per person, latest wins (the server already does this)
    responses = [...new Map(responses.map((r) => [r.name.toLowerCase(), r])).values()];

    if (!responses.length) {
      summary.append(el('p', 'muted', fromServer ? 'No answers yet.' : "That link didn't contain any answers."));
      summary.append(arrowLink('Pick your days', location.pathname));
      return;
    }

    const cells = renderCalendar({ disablePast: false });
    const counts = new Map();
    const who = new Map();
    for (const r of responses) {
      for (const i of r.days) {
        counts.set(i, (counts.get(i) || 0) + 1);
        (who.get(i) || who.set(i, []).get(i)).push(r.name);
      }
    }
    const max = responses.length;
    for (const [i, btn] of cells) {
      const n = counts.get(i) || 0;
      if (!n) continue;
      btn.classList.add('has');
      if (n / max > 0.5) btn.classList.add('hi');
      btn.style.setProperty('--n', String(n / max));
      btn.dataset.count = n;
      btn.setAttribute('aria-label', `${fmtDay.format(dateAt(i))}, ${n} of ${max} free`);
    }

    // header: who answered, and the days that work for the most people
    const names = responses.map((r) => r.name);
    summary.append(
      el('p', null, `${max} ${max === 1 ? 'answer' : 'answers'} so far: ${listNames(names)}.`)
    );
    const best = [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    if (best.length) {
      const top = best[0][1];
      const topDays = best.filter(([, n]) => n === top).map(([i]) => fmtDay.format(dateAt(i)));
      const line =
        top === max && max > 1
          ? `Everyone can do ${listNames(topDays)}.`
          : `Best so far (${top} of ${max}): ${topDays.slice(0, 6).join(', ')}${topDays.length > 6 ? '…' : ''}.`;
      summary.append(el('p', 'muted mt-4', line));
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

    // tap a day to see who's free
    months.addEventListener('click', (e) => {
      const btn = e.target.closest('.day[data-index]');
      if (!btn) return;
      const i = +btn.dataset.index;
      const free = who.get(i) || [];
      months.querySelectorAll('.day.active').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      detail.hidden = false;
      detail.textContent = free.length
        ? `${fmtDay.format(dateAt(i))}: ${listNames(free)} (${free.length} of ${max})`
        : `${fmtDay.format(dateAt(i))}: nobody yet`;
    });

    share.hidden = false;
    if (fromServer) {
      share.append(arrowLink('Add or change your days', location.pathname));
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
    share.append(arrowLink('Add your own days', location.pathname));
  }

  if (codes.length || fromServer) {
    renderResults();
    return;
  }

  /* ---------- form mode ---------- */

  const cells = renderCalendar({ disablePast: true });
  const selected = new Set();
  const nameInput = form.querySelector('#avail-name');
  const noteInput = form.querySelector('#avail-note');
  const count = form.querySelector('.avail-count');
  const clear = form.querySelector('.avail-clear');
  const storeKey = `avail:${from}:${to}`;

  const setDay = (i, on) => {
    const btn = cells.get(i);
    if (!btn) return;
    on ? selected.add(i) : selected.delete(i);
    btn.setAttribute('aria-pressed', String(on));
  };

  const update = () => {
    const n = selected.size;
    count.textContent = n ? `${n} ${n === 1 ? 'day' : 'days'} selected` : 'No days selected';
    clear.hidden = !n;
    say('');
    try {
      localStorage.setItem(
        storeKey,
        JSON.stringify({ name: nameInput.value, note: noteInput.value, days: [...selected] })
      );
    } catch {}
  };

  // restore a draft so a refresh doesn't wipe their picks
  try {
    const draft = JSON.parse(localStorage.getItem(storeKey) || 'null');
    if (draft) {
      nameInput.value = draft.name || '';
      noteInput.value = draft.note || '';
      for (const i of draft.days || []) setDay(i, true);
    }
  } catch {}
  for (const btn of cells.values()) btn.setAttribute('aria-pressed', String(selected.has(+btn.dataset.index)));
  update();

  // Paint selection: the first cell decides on/off, dragging applies it to the rest.
  // elementFromPoint instead of pointerover because a touch pointer is implicitly
  // captured by the cell it started on.
  let paint = null;
  months.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('.day[data-index]');
    if (!btn || e.button) return;
    e.preventDefault();
    paint = btn.getAttribute('aria-pressed') !== 'true';
    setDay(+btn.dataset.index, paint);
    update();
  });
  document.addEventListener('pointermove', (e) => {
    if (paint === null) return;
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const btn = under && under.closest('.day[data-index]');
    if (btn && btn.getAttribute('aria-pressed') !== String(paint)) {
      setDay(+btn.dataset.index, paint);
      update();
    }
  });
  const stop = () => {
    paint = null;
  };
  document.addEventListener('pointerup', stop);
  document.addEventListener('pointercancel', stop);
  months.addEventListener('keydown', (e) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    const btn = e.target.closest('.day[data-index]');
    if (!btn) return;
    e.preventDefault();
    setDay(+btn.dataset.index, btn.getAttribute('aria-pressed') !== 'true');
    update();
  });

  clear.addEventListener('click', () => {
    for (const i of [...selected]) setDay(i, false);
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
      say('Pick at least one day first.');
      return;
    }
    const days = [...selected].sort((a, b) => a - b);

    const note = noteInput.value.trim();
    const shareLink = () =>
      `${location.origin}${location.pathname}?r=${encode({ n: name, m: note, d: packDays(days) })}`;

    if (endpoint) {
      const payload = { name, note, from, days: days.map((i) => iso(dateAt(i))) };
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
        share.append(el('p', 'muted', `Thanks, ${name}. Send again any time to change your days.`));
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
