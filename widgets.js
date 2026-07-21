// Interactive demo widgets for posts. Each renders the shared demo-card chrome:
// <div class="demo"><div class="demo-stage">…</div></div> + optional caption.

class Demo extends HTMLElement {
  connectedCallback() {
    const caption = this.getAttribute('caption');
    this.innerHTML =
      `<div class="demo"><div class="demo-stage" style="height:${this.height}px">${this.stage()}</div></div>` +
      (caption ? `<p class="demo-caption">${caption}</p>` : '');
    this.init();
  }
  init() {}
}

// Two identical buttons — one snaps its hover color, one eases it.
customElements.define('demo-transition', class extends Demo {
  height = 256;
  stage() {
    return `<button class="pill-dark">Paste</button>
            <button class="pill-dark eased">Paste</button>`;
  }
});

// The same dropdown at two speeds.
customElements.define('demo-speed', class extends Demo {
  height = 288;
  stage() {
    const col = (ms) => `
      <div class="demo-col">
        <div class="demo-menu" data-ms="${ms}" style="transition: transform ${ms}ms cubic-bezier(0.16, 1, 0.3, 1), opacity ${ms}ms ease-out">
          <div>Open</div><div>Rename</div><div>Duplicate</div><div>Delete</div>
        </div>
        <button class="pill-white">Options</button>
      </div>`;
    return col(180) + col(400);
  }
  init() {
    for (const col of this.querySelectorAll('.demo-col')) {
      const menu = col.querySelector('.demo-menu');
      col.querySelector('button').addEventListener('click', () => menu.classList.toggle('open'));
    }
  }
});

// A minimal stacking toast. ponytail: 3-deep fixed stack, no swipe/hover-expand — reach for a real library when a product needs one.
customElements.define('demo-toast', class extends Demo {
  height = 288;
  stage() {
    return `<button class="pill-dark">Show toast</button><div class="demo-toast-viewport"></div>`;
  }
  init() {
    const viewport = this.querySelector('.demo-toast-viewport');
    const render = () => {
      [...viewport.children].reverse().forEach((toast, i) => {
        toast.style.transform = `translateY(${-i * 14}px) scale(${1 - i * 0.05})`;
        toast.style.opacity = i > 2 ? '0' : String(1 - i * 0.25);
      });
    };
    this.querySelector('button').addEventListener('click', () => {
      const toast = document.createElement('div');
      toast.className = 'demo-toast-item';
      toast.textContent = 'Saved to library';
      toast.style.transform = 'translateY(24px)';
      toast.style.opacity = '0';
      viewport.append(toast);
      void toast.offsetHeight; // flush styles so the enter transition has a start state
      render();
      setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => { toast.remove(); render(); }, 400);
      }, 4000);
    });
  }
});

// A button that morphs between two labels, easing its width along.
customElements.define('demo-morph', class extends Demo {
  height = 256;
  stage() {
    return `<button class="morph-button"><span>Feedback</span></button>`;
  }
  init() {
    const btn = this.querySelector('button');
    const label = btn.querySelector('span');
    btn.addEventListener('click', () => {
      if (btn.dataset.busy) return;
      btn.dataset.busy = '1';
      const morphTo = (text, width) => {
        label.classList.add('morph-out');
        setTimeout(() => {
          label.textContent = text;
          btn.style.width = width;
          label.classList.remove('morph-out');
          label.classList.add('morph-in');
          void label.offsetHeight; // flush so morph-in registers as the transition start state
          label.classList.remove('morph-in');
        }, 150);
      };
      morphTo('Thanks for sharing!', '170px');
      setTimeout(() => {
        morphTo('Feedback', '110px');
        setTimeout(() => delete btn.dataset.busy, 300);
      }, 2200);
    });
  }
});

// The same six long-lived sessions on Fargate vs EC2. Traffic drops by 2:
// Fargate frees per-session micro-VMs one by one; EC2 binpacks onto hosts and
// only reclaims a host once binpack has already drained it — a live session
// never hops between hosts (ECS does not live-migrate running tasks).
customElements.define('demo-scalein', class extends Demo {
  height = 320;
  stage() {
    const box = (id) => `<div class="scalein-box" data-id="${id}"></div>`;
    return `
      <div class="scalein">
        <div class="scalein-panel">
          <div class="scalein-head">
            <span class="scalein-title">Fargate</span>
            <span class="scalein-stat" data-stat="fargate">6 sessions · 6 micro-VMs</span>
          </div>
          <div class="scalein-sessions" data-role="fargate">${[0, 1, 2, 3, 4, 5].map(box).join('')}</div>
        </div>
        <div class="scalein-panel">
          <div class="scalein-head">
            <span class="scalein-title">EC2</span>
            <span class="scalein-stat" data-stat="ec2">6 sessions · 2 hosts</span>
          </div>
          <div class="scalein-hosts">
            <div class="scalein-host" data-host="a">
              <span class="scalein-host-label">Host A</span>
              <div class="scalein-host-sessions">${[0, 1, 2, 3].map(box).join('')}</div>
            </div>
            <div class="scalein-host" data-host="b">
              <span class="scalein-host-label">Host B</span>
              <div class="scalein-host-sessions">${[0, 1].map(box).join('')}</div>
            </div>
          </div>
        </div>
        <button class="scalein-btn pill-dark"><span>Drop traffic</span></button>
      </div>`;
  }
  init() {
    const btn = this.querySelector('.scalein-btn');
    const label = btn.querySelector('span');
    // same blur-morph as demo-morph's Feedback button
    const morphTo = (text, width) => {
      label.classList.add('morph-out');
      setTimeout(() => {
        label.textContent = text;
        btn.style.width = width;
        label.classList.remove('morph-out');
        label.classList.add('morph-in');
        void label.offsetHeight; // flush so morph-in registers as the transition start state
        label.classList.remove('morph-in');
      }, 150);
    };
    const statFargate = this.querySelector('[data-stat="fargate"]');
    const statEc2 = this.querySelector('[data-stat="ec2"]');
    const victims = [...this.querySelectorAll('[data-role="fargate"] .scalein-box')].slice(-2);
    const hostB = this.querySelector('[data-host="b"]');
    const hostBBoxes = [...hostB.querySelectorAll('.scalein-box')];

    // stagger a class change across boxes; exited boxes keep their slot (opacity 0,
    // never display:none) so the layout never snaps, and re-entry just removes the
    // persistent exit class — the transition retargets from the current state.
    const stagger = (els, step, fn) => {
      els.forEach((el, i) => {
        el.style.transitionDelay = `${i * step}ms`;
        fn(el);
      });
    };

    const MORPH_MS = 450; // label out 150ms + width ease 300ms

    btn.addEventListener('click', () => {
      if (btn.dataset.busy) return;
      btn.dataset.busy = '1';

      if (btn.dataset.state !== 'dropped') {
        // traffic drops: 2 sessions end in place on Fargate, 2 on EC2's Host B
        const wait = (Math.max(victims.length, hostBBoxes.length) - 1) * 50 + 200; // last exit lands
        const total = wait + 260; // + host reclaim fade
        stagger(victims, 50, (el) => el.classList.add('scalein-exit'));
        stagger(hostBBoxes, 50, (el) => el.classList.add('scalein-exit'));
        setTimeout(() => morphTo('Reset', '94px'), total - MORPH_MS); // morph ends with the reclaim
        setTimeout(() => {
          hostB.classList.add('scalein-reclaimed'); // now empty — reclaim it in place
          statFargate.textContent = '4 sessions · 4 bills';
          statEc2.textContent = '4 sessions · 1 host';
        }, wait);
        setTimeout(() => {
          btn.dataset.state = 'dropped';
          delete btn.dataset.busy;
        }, total);
      } else {
        // reset: host comes back first, then sessions fade back in
        const wait = (Math.max(victims.length, hostBBoxes.length) - 1) * 40 + 220; // last re-entry lands
        const total = 260 + wait; // host un-ghost first
        hostB.classList.remove('scalein-reclaimed');
        setTimeout(() => morphTo('Drop traffic', '136px'), total - MORPH_MS); // morph ends with the last box
        setTimeout(() => {
          stagger(victims, 40, (el) => el.classList.remove('scalein-exit'));
          stagger(hostBBoxes, 40, (el) => el.classList.remove('scalein-exit'));
          statFargate.textContent = '6 sessions · 6 micro-VMs';
          statEc2.textContent = '6 sessions · 2 hosts';
        }, 260);
        setTimeout(() => {
          btn.dataset.state = 'full';
          delete btn.dataset.busy;
        }, total);
      }
    });
  }
});

// One tick of a platform loop that tends the autoscaler rather than replacing
// it: scan four dull rules, report what was seen, fire the one whose condition
// is true. Its authority is narrower than its attention — every action is a
// flag or a proposal, never a scale operation. Tick 5 fires nothing; most of a
// loop's life is deciding to do nothing.
customElements.define('demo-loop', class extends Demo {
  height = 320;
  stage() {
    const rule = (cond, act) => `<div class="loop-rule"><span>${cond}</span><span>${act}</span></div>`;
    return `
      <div class="loop">
        <div class="loop-state" aria-live="polite"><span>3 hosts · ami 9d · 0 flags</span></div>
        <div class="loop-rules">
          ${rule('if reserved &gt;&gt; used', '→ flag the drift')}
          ${rule('if task pending 5m', '→ explain why')}
          ${rule('if ami &gt; 14d old', '→ propose a roll')}
          ${rule('if drain &gt; 30m', '→ raise an alert')}
        </div>
        <div class="loop-saw" aria-live="polite"><span>sleeping</span></div>
        <button class="loop-btn pill-dark">Run tick</button>
      </div>`;
  }
  init() {
    const rows = [...this.querySelectorAll('.loop-rule')];
    const stateEl = this.querySelector('.loop-state span');
    const sawEl = this.querySelector('.loop-saw span');
    const btn = this.querySelector('.loop-btn');

    const morph = (el, text) => {
      el.classList.add('morph-out');
      setTimeout(() => {
        el.textContent = text;
        el.classList.remove('morph-out');
        el.classList.add('morph-in');
        void el.offsetHeight; // flush so morph-in registers as the transition start state
        el.classList.remove('morph-in');
      }, 150);
    };

    const TICKS = [
      { saw: 'saw: api reserves 512m, uses 190m', fires: 0, state: '3 hosts · ami 9d · 1 flag' },
      { saw: 'saw: task pending 6m, no memory fit', fires: 1, state: '3 hosts · ami 11d · 2 flags' },
      { saw: 'saw: ami at 15d', fires: 2, state: '3 hosts · ami 15d · 3 flags' },
      { saw: 'saw: host B draining 42m', fires: 3, state: '3 hosts · ami 15d · 4 flags' },
      { saw: 'saw: all clear — flags reviewed', fires: null, state: '3 hosts · ami 0d · 0 flags' },
    ];
    let t = 0;

    btn.addEventListener('click', () => {
      if (btn.dataset.busy) return;
      btn.dataset.busy = '1';
      rows.forEach((r) => r.classList.remove('loop-fired'));

      const tick = TICKS[t % TICKS.length];
      t++;
      const last = tick.fires ?? rows.length - 1; // scan stops where a rule fires
      for (let i = 0; i <= last; i++) {
        setTimeout(() => rows[i].classList.add('loop-scan'), i * 90);
        setTimeout(() => rows[i].classList.remove('loop-scan'), i * 90 + 180);
      }
      const scanMs = last * 90 + 180;
      setTimeout(() => {
        morph(sawEl, tick.saw);
        if (tick.fires != null) rows[tick.fires].classList.add('loop-fired');
      }, scanMs);
      setTimeout(() => morph(stateEl, tick.state), scanMs + 220);
      setTimeout(() => delete btn.dataset.busy, scanMs + 520);
    });
  }
});
