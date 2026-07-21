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
