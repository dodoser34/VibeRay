import transitionTexts from '@/texts/ru/transition.json';

// Переход между страницами «бумажная карта-оригами». Сложенная карта вылетает из точки клика,
// разворачивается на весь экран, падает метка, и к следующей странице прокладывается маршрут, пока
// она грузится; затем карта складывается и улетает к своей вкладке в таб-баре. Обычный класс поверх
// GSAP; цвета — из CSS-переменных (MapFoldTransition.css → токены).
const TAU = Math.PI * 2,
  RAD = Math.PI / 180,
  NS = 'http://www.w3.org/2000/svg';
const FOLD = 179.2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const el = (tag, cls, parent) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (parent) parent.appendChild(e);
  return e;
};
const f1 = (n) => n.toFixed(1);

function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeNoise(seed) {
  const hash = (x, y) => {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const sm = (t) => t * t * (3 - 2 * t);
  const n = (x, y) => {
    const xi = Math.floor(x),
      yi = Math.floor(y),
      u = sm(x - xi),
      v = sm(y - yi);
    const a = hash(xi, yi),
      b = hash(xi + 1, yi),
      c = hash(xi, yi + 1),
      d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  return (x, y, oct = 1) => {
    let s = 0,
      amp = 1,
      f = 1,
      tot = 0;
    for (let o = 0; o < oct; o++) {
      s += n(x * f + o * 17.3, y * f + o * 9.1) * amp;
      tot += amp;
      amp *= 0.5;
      f *= 2;
    }
    return s / tot;
  };
}
function clipHalf(poly, p, q) {
  const nx = q[0] - p[0],
    ny = q[1] - p[1],
    mx = (p[0] + q[0]) / 2,
    my = (p[1] + q[1]) / 2,
    f = (v) => (v[0] - mx) * nx + (v[1] - my) * ny,
    out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      fa = f(a),
      fb = f(b);
    if (fa <= 0) out.push(a);
    if (fa <= 0 !== fb <= 0) {
      const t = fa / (fa - fb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}
const MS = {
  1: [[3, 2]],
  2: [[2, 1]],
  3: [[3, 1]],
  4: [[0, 1]],
  5: [
    [3, 0],
    [2, 1],
  ],
  6: [[0, 2]],
  7: [[3, 0]],
  8: [[3, 0]],
  9: [[0, 2]],
  10: [
    [0, 1],
    [3, 2],
  ],
  11: [[0, 1]],
  12: [[3, 1]],
  13: [[2, 1]],
  14: [[3, 2]],
};

export class MapFoldTransition {
  constructor(options = {}) {
    this.gsap = options.gsap;
    this.opts = Object.assign(
      {
        container: document.body,
        zIndex: 9999,
        seed: 7,
        packetSize: 64,
        minRouteTime: 0.7,
        durationScale: 1,
        reducedMotion: 'auto',
        caption: transitionTexts.caption,
        dprCap: 2,
      },
      options,
    );
    this._uid = 'vrmt' + Math.random().toString(36).slice(2, 8);
    this._state = 'idle';
    this._tls = new Set();
    this._mq = matchMedia('(prefers-reduced-motion: reduce)');
    this._buildRoot();
    this._onResize = () => {
      clearTimeout(this._rz);
      this._rz = setTimeout(() => {
        if (this._state === 'idle') this._ready = this._layout();
        else this._dirty = true;
      }, 180);
    };
    this._onVis = () => this._tls.forEach((t) => (document.hidden ? t.pause() : t.resume()));
    addEventListener('resize', this._onResize);
    document.addEventListener('visibilitychange', this._onVis);
    this._ready = this._layout();
  }

  get reduced() {
    const r = this.opts.reducedMotion;
    return r === 'auto' ? this._mq.matches : !!r;
  }

  // ─── Публичный API ───────────────────────────────────────
  // Тема сменилась: бумажная карта перерисовывается в цветах новой темы (во время перехода — после).
  refreshTheme() {
    if (this._state === 'idle') this._ready = this._layout();
    else this._dirty = true;
  }

  async cover({ x, y, label = '', from: fromLabel = '', targetRect = null } = {}) {
    if (this._state === 'disposed') return;
    if (this._state === 'covering' || this._state === 'covered') return this._coverPromise;
    if (this._state === 'revealing') await this._revealPromise;
    this._state = 'covering';
    this._coverPromise = (async () => {
      // Раскладка, которая не построилась (например, до применения стилей), просто строится заново.
      await this._ready.catch(() => {
        this._dirty = true;
      });
      if (
        this._dirty ||
        this.W !== (document.documentElement.clientWidth || innerWidth) ||
        this.H !== innerHeight ||
        !this._cssOk()
      ) {
        this._ready = this._layout();
        await this._ready;
      }
      const { W, H } = this;
      this._target = targetRect;
      this._paintFaces(false);
      this._resetFx();
      this._prepareRoute(label, fromLabel);
      this.el.classList.add('is-active');
      if (this.reduced) return this._coverReduced();
      const g = this.gsap,
        fl = this.fl,
        s0 = this.opts.packetSize / Math.max(this.w, this.h);
      Object.assign(fl, { x: x ?? W / 2, y: y ?? H / 2, s: s0, rz: -28, rx: 28, ry: -18, sh: 1 });
      this.col.forEach((c, i) => (c.a = i ? (i % 2 ? -FOLD : FOLD) : 0));
      this.row.forEach((r, j) => (r.a = j ? (j % 2 ? FOLD : -FOLD) : 0));
      g.set(this.stage, { opacity: 1 });
      this._render();
      const tl = this._tl({ onUpdate: () => this._render() });
      const from = { x: fl.x, y: fl.y },
        to = { x: W / 2, y: H / 2 },
        ctl = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - H * 0.2 },
        p = { t: 0 };
      tl.to(
        p,
        {
          t: 1,
          duration: 0.34,
          ease: 'power2.inOut',
          onUpdate: () => {
            const t = p.t,
              u = 1 - t;
            fl.x = u * u * from.x + 2 * u * t * ctl.x + t * t * to.x;
            fl.y = u * u * from.y + 2 * u * t * ctl.y + t * t * to.y;
          },
        },
        0,
      )
        .to(fl, { s: 0.8, duration: 0.34, ease: 'power2.in' }, 0)
        .to(fl, { rz: 0, rx: 0, ry: 0, duration: 0.44, ease: 'back.out(1.8)' }, 0.1)
        .to(fl, { s: 1, duration: 0.42, ease: 'power3.out' }, 0.34)
        .to(fl, { sh: 0, duration: 0.3, ease: 'power1.in' }, 0.36);
      for (let i = 1; i < this.N; i++)
        tl.to(this.col[i], { a: 0, duration: 0.22, ease: 'back.out(1.1)' }, 0.24 + (i - 1) * 0.06);
      const rowStart = 0.24 + (this.N - 2) * 0.06 + 0.1;
      for (let j = 1; j < this.M; j++)
        tl.to(
          this.row[j],
          { a: 0, duration: 0.24, ease: 'back.out(1.1)' },
          rowStart + (j - 1) * 0.07,
        );
      await tl._done;
      this._covered();
    })();
    return this._coverPromise;
  }

  async waitFor(promise) {
    await this._coverPromise;
    const res = await Promise.allSettled([Promise.resolve(promise), this._minTime()]);
    if (res[0].status === 'rejected') throw res[0].reason;
    return res[0].value;
  }

  // onFold: вызывается, когда страница начинает открываться (момент, когда должно начаться её
  // появление).
  async reveal({ page, onFold } = {}) {
    if (this._state === 'idle' || this._state === 'disposed') return;
    if (this._state === 'revealing') return this._revealPromise;
    await this._coverPromise;
    this._state = 'revealing';
    this._revealPromise = (async () => {
      await this._minTime();
      const g = this.gsap;
      if (this.reduced) {
        onFold?.();
        const tl = this._tl();
        tl.to(this.stage, { opacity: 0, duration: 0.2, ease: 'none' }, 0);
        tl.to([this.fx, this.labelEl, this.originEl], { opacity: 0, duration: 0.2 }, 0);
        if (page)
          tl.fromTo(page, { opacity: 0 }, { opacity: 1, duration: 0.2, clearProps: 'opacity' }, 0);
        await tl._done;
        return this._finishReveal();
      }
      this._kill(this._loop);
      this._kill(this._intro);
      const q = this.q,
        fin = this._tl();
      fin
        .to(q.pinBody, { y: 0, scaleX: 1, scaleY: 1, duration: 0.2, ease: 'power2.out' }, 0)
        .to(q.pinShadow, { scale: 1, opacity: 0.45, duration: 0.2 }, 0)
        .to(this._chars, { opacity: 1, y: 0, scale: 1, duration: 0.2, stagger: 0.008 }, 0)
        .to(this.ruleEl, { scaleX: 1, duration: 0.2 }, 0)
        .to(q.dest, { opacity: 1, duration: 0.2 }, 0)
        .to(q.rings, { opacity: 0, duration: 0.15 }, 0)
        .to(q.mask, { strokeDashoffset: 0, duration: 0.28, ease: 'power2.out' }, 0);
      (this._route?.seq || []).forEach((s) =>
        fin.to(this.districts[s.d].el, { opacity: 0.24, duration: 0.28, overwrite: 'auto' }, 0),
      );
      await fin._done;
      // «Печатаем» маршрут на бумагу и складываем его вместе с картой
      this._captureLabel();
      this._paintFaces(true);
      q.hl.style.visibility =
        q.route.style.visibility =
        q.dest.style.visibility =
        this.labelEl.style.visibility =
        this.originEl.style.visibility =
          'hidden';
      onFold?.();
      if (page) g.set(page, { opacity: 0, y: 16 });
      const fl = this.fl,
        { W, H } = this,
        tl = this._tl({ onUpdate: () => this._render() });
      tl.to(q.pinBody, { y: -46, opacity: 0, duration: 0.2, ease: 'power2.in' }, 0).to(
        q.pinShadow,
        { opacity: 0, duration: 0.15 },
        0,
      );
      let t = 0.05;
      for (let j = this.M - 1; j >= 1; j--, t += 0.05)
        tl.to(this.row[j], { a: j % 2 ? FOLD : -FOLD, duration: 0.18, ease: 'power3.inOut' }, t);
      t = t - 0.05 + 0.15;
      for (let i = this.N - 1; i >= 1; i--, t += 0.04)
        tl.to(this.col[i], { a: i % 2 ? -FOLD : FOLD, duration: 0.18, ease: 'power3.inOut' }, t);
      const foldEnd = t - 0.04 + 0.18;
      tl.to(fl, { s: 0.62, duration: foldEnd - 0.1, ease: 'power2.inOut' }, 0.1).to(
        fl,
        { sh: 1, duration: 0.2 },
        foldEnd - 0.2,
      );
      const r = this._target,
        tx = r ? r.left + r.width / 2 : W / 2,
        ty = r ? r.top + r.height / 2 : -80;
      const sT = (r ? clamp(r.height, 18, 40) : 24) / Math.max(this.w, this.h);
      const from = { x: W / 2, y: H / 2 },
        ctl = {
          x: (from.x + tx) / 2 + (tx - from.x) * 0.15,
          y: Math.min(from.y, ty) + (from.y - ty) * 0.15,
        },
        p = { t: 0 },
        fd = 0.32,
        ft = foldEnd - 0.06;
      tl.to(
        p,
        {
          t: 1,
          duration: fd,
          ease: 'power2.in',
          onUpdate: () => {
            const k = p.t,
              u = 1 - k;
            fl.x = u * u * from.x + 2 * u * k * ctl.x + k * k * tx;
            fl.y = u * u * from.y + 2 * u * k * ctl.y + k * k * ty;
          },
        },
        ft,
      )
        .to(fl, { s: sT, rz: -20, rx: 26, ry: 12, duration: fd, ease: 'power2.in' }, ft)
        .to(this.stage, { opacity: 0, duration: 0.1, ease: 'none' }, ft + fd - 0.1);
      if (page)
        tl.to(
          page,
          { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', clearProps: 'transform,opacity' },
          0.12,
        );
      await tl._done;
      this._finishReveal();
    })();
    return this._revealPromise;
  }

  dispose() {
    this._tls.forEach((t) => t.kill());
    this._tls.clear();
    removeEventListener('resize', this._onResize);
    document.removeEventListener('visibilitychange', this._onVis);
    clearTimeout(this._rz);
    (this.faces || []).forEach((f) => {
      f.cv.width = f.cv.height = 0;
    });
    if (this.master) this.master.width = this.master.height = 0;
    this.el.remove();
    this._state = 'disposed';
  }

  // ─── Внутреннее ──────────────────────────────────────────
  _tl(vars = {}) {
    let res;
    const done = new Promise((r) => (res = r));
    const tl = this.gsap.timeline({
      ...vars,
      onComplete: () => {
        this._tls.delete(tl);
        vars.onComplete && vars.onComplete();
        res();
      },
    });
    tl._done = done;
    tl.timeScale(1 / (this.opts.durationScale || 1));
    this._tls.add(tl);
    return tl;
  }
  _kill(tl) {
    if (tl) {
      tl.kill();
      this._tls.delete(tl);
    }
  }
  _cssOk() {
    const ok =
      getComputedStyle(this.el).visibility === 'hidden' &&
      getComputedStyle(this.el).pointerEvents === 'none';
    return ok ? (this._cssSeen ? true : ((this._cssSeen = true), false)) : true;
  }
  _minTime() {
    const ms =
      this.opts.minRouteTime * 1000 * (this.opts.durationScale || 1) -
      (performance.now() - (this._p2Start || 0));
    return new Promise((r) => setTimeout(r, Math.max(0, ms)));
  }

  _covered() {
    this._state = 'covered';
    this._p2Start = performance.now();
    if (!this.reduced) this._startRoute();
  }

  _coverReduced() {
    const { W, H } = this,
      g = this.gsap;
    Object.assign(this.fl, { x: W / 2, y: H / 2, s: 1, rz: 0, rx: 0, ry: 0, sh: 0 });
    this.col.forEach((c) => (c.a = 0));
    this.row.forEach((r) => (r.a = 0));
    this._render();
    const q = this.q,
      r = this._newRoute();
    g.set(q.mask, { strokeDashoffset: 0 });
    r.seq.forEach((s) => g.set(this.districts[s.d].el, { opacity: 0.24 }));
    g.set(q.dest, { opacity: 1 });
    g.set(this._chars, { opacity: 1, y: 0, scale: 1 });
    g.set(this.ruleEl, { scaleX: 1 });
    g.set([q.pinBody], { y: 0, opacity: 1 });
    g.set(q.pinShadow, { opacity: 0.45, scale: 1 });
    g.set([this.fx, this.labelEl], { opacity: 1 });
    const tl = this._tl();
    tl.fromTo(this.stage, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'none' }, 0).fromTo(
      [this.fx, this.labelEl, this.originEl],
      { opacity: 0 },
      { opacity: 1, duration: 0.2, ease: 'none' },
      0,
    );
    return tl._done.then(() => this._covered());
  }

  _finishReveal() {
    this.el.classList.remove('is-active');
    this._resetFx();
    this._state = 'idle';
    if (this._dirty) this._ready = this._layout();
  }

  _buildRoot() {
    this.el = el('div', 'vr-mt');
    this.el.setAttribute('aria-hidden', 'true');
    this.el.style.cssText = `position:fixed;inset:0;overflow:hidden;z-index:${this.opts.zIndex}`;
    this.stage = el('div', 'vr-mt__stage', this.el);
    this.flyer = el('div', 'vr-mt__flyer', this.stage);
    this.shadowEl = el('div', 'vr-mt__shadow', this.flyer);
    this.sheet = el('div', 'vr-mt__sheet', this.flyer);
    this.fx = document.createElementNS(NS, 'svg');
    this.fx.setAttribute('class', 'vr-mt__fx');
    this.el.appendChild(this.fx);
    this.labelEl = el('div', 'vr-mt__label', this.el);
    this.originEl = el('div', 'vr-mt__label vr-mt__origin', this.el);
    this.fl = { x: 0, y: 0, s: 1, rz: 0, rx: 0, ry: 0, sh: 0 };
    this.opts.container.appendChild(this.el);
  }

  async _fonts() {
    if (!document.fonts) return;
    const specs = [
      '600 24px Unbounded',
      '600 11px Unbounded',
      '500 10px Manrope',
      '600 10px Manrope',
    ];
    await Promise.race([
      Promise.all(specs.map((s) => document.fonts.load(s).catch(() => {}))),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  }

  // Каждый цвет — CSS-переменная на оверлее (MapFoldTransition.css связывает их с токенами).
  _readColors() {
    const cs = getComputedStyle(this.el);
    const v = (name) => cs.getPropertyValue(name).trim();
    return {
      bg: v('--color-bg'),
      paper: v('--color-paper'),
      paper2: v('--color-paper-2'),
      border: v('--color-border'),
      isoline: v('--color-isoline'),
      street: v('--color-street'),
      accent: v('--color-accent'),
      accentHover: v('--color-accent-hover'),
      text: v('--color-text'),
      text2: v('--color-text-2'),
      river: v('--color-river'),
      route: v('--color-route'),
      shade: v('--color-shade'),
      light: v('--color-light'),
      display: v('--vr-font-display'),
      textFont: v('--vr-font-text'),
      districts: Array.from({ length: 12 }, (_, k) => v(`--district-${k + 1}`)),
    };
  }

  async _layout() {
    await (this._fontsP ||= this._fonts());
    const W = document.documentElement.clientWidth || innerWidth,
      H = innerHeight;
    // Окно нулевого размера (свёрнутая или скрытая вкладка): карту построим перед переходом.
    if (!W || !H) {
      this._dirty = true;
      return;
    }
    const dpr = Math.min(this.opts.dprCap, devicePixelRatio || 1),
      mobile = W < 640;
    let N, M;
    if (mobile) {
      const a = W / 3 / (H / 2),
        b = W / 2 / (H / 3);
      [N, M] = Math.abs(Math.log(a)) <= Math.abs(Math.log(b)) ? [3, 2] : [2, 3];
    } else {
      M = 3;
      N = clamp(Math.round(W / (H / M)), 4, 6);
    }
    Object.assign(this, { W, H, dpr, N, M, w: W / N, h: H / M, mobile });
    this.C = this._readColors();
    if (getComputedStyle(this.el).visibility === 'hidden') this._cssSeen = true;
    this._model();
    this._renderMaster();
    this._buildSheet();
    this._buildFx();
    this._dirty = false;
  }

  _model() {
    const { W, H, mobile } = this,
      rnd = mulberry32(this.opts.seed),
      noise = makeNoise(this.opts.seed);
    const rx0 = W * (mobile ? 0.9 : 0.875),
      ramp = W * (mobile ? 0.028 : 0.032),
      ph = rnd() * TAU;
    const rX = (y) =>
      rx0 + Math.sin((y / H) * TAU * 1.15 + ph) * ramp + (noise(3.1, y / 240) - 0.5) * ramp * 1.6;
    const rW = (y) => (mobile ? 8 : 13) + noise(7.7, y / 320) * (mobile ? 6 : 12);
    const L = [],
      R = [];
    for (let y = -24; y <= H + 24; y += 8) {
      const c = rX(y),
        hw = rW(y) / 2;
      L.push([c - hw, y]);
      R.push([c + hw, y]);
    }
    this.river = { L, R };
    this.westPoly = [[-40, -24], ...L, [-40, H + 24]];
    this.west = (x, y, m = 0) => x < rX(y) - rW(y) / 2 - m;
    const seeds = [];
    for (let k = 0; k < 15; k++) {
      let best = null,
        bd = -1;
      for (let c = 0; c < 28; c++) {
        const y = H * (0.04 + 0.92 * rnd()),
          x = W * 0.03 + (rX(y) - W * 0.07) * rnd();
        let d = Infinity;
        for (const s of seeds) d = Math.min(d, Math.hypot(s[0] - x, s[1] - y));
        if (d > bd) {
          bd = d;
          best = [x, y];
        }
      }
      seeds.push(best);
    }
    this.seeds = seeds;
    const box = [
        [-40, -40],
        [W + 40, -40],
        [W + 40, H + 40],
        [-40, H + 40],
      ],
      wa = mobile ? 5 : 8;
    const warp = (x, y) => [
      x + (noise(x / 90 + 11, y / 90) - 0.5) * 2 * wa,
      y + (noise(x / 90, y / 90 + 23) - 0.5) * 2 * wa,
    ];
    this.districts = seeds.map((p, i) => {
      let poly = box;
      seeds.forEach((q, j) => {
        if (j !== i) poly = clipHalf(poly, p, q);
      });
      const pts = [];
      for (let e = 0; e < poly.length; e++) {
        const a = poly[e],
          b = poly[(e + 1) % poly.length],
          n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 12));
        for (let t = 0; t < n; t++)
          pts.push(warp(a[0] + ((b[0] - a[0]) * t) / n, a[1] + ((b[1] - a[1]) * t) / n));
      }
      const path = new Path2D();
      pts.forEach((q, k) => (k ? path.lineTo(q[0], q[1]) : path.moveTo(q[0], q[1])));
      path.closePath();
      return { pts, path, k: i % 12, color: this.C.districts[i % 12] };
    });
    const s = mobile ? 44 : 62,
      rot = -0.11,
      cr = Math.cos(rot),
      sr = Math.sin(rot),
      cx = W / 2,
      cy = H / 2,
      A = s * 0.16;
    this.lat = { s, n: Math.ceil(Math.hypot(W, H) / 2 / s) + 2 };
    this.node = (i, j) => {
      const bx = i * s,
        by = j * s,
        X = cx + bx * cr - by * sr,
        Y = cy + bx * sr + by * cr;
      return [
        X + (noise(X / 160 + 5, Y / 160) - 0.5) * 2 * A,
        Y + (noise(X / 160, Y / 160 + 9) - 0.5) * 2 * A,
      ];
    };
    this.toLat = (x, y) => {
      const dx = x - cx,
        dy = y - cy;
      return [(dx * cr + dy * sr) / s, (-dx * sr + dy * cr) / s];
    };
    this.compass = mobile ? { x: 34, y: 92, r: 15 } : { x: W - 46, y: 104, r: 20 };
    this.noise = noise;
  }

  _renderMaster() {
    const { W, H, dpr, C, mobile, N, M, w, h } = this;
    const c = this.master || (this.master = document.createElement('canvas'));
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = C.paper;
    g.fillRect(0, 0, W, H);
    const vg = g.createRadialGradient(
      W / 2,
      H / 2,
      Math.min(W, H) * 0.2,
      W / 2,
      H / 2,
      Math.hypot(W, H) * 0.6,
    );
    vg.addColorStop(0, `rgba(${C.shade},0)`);
    vg.addColorStop(1, `rgba(${C.shade},.28)`);
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);
    // изолинии (marching squares)
    const cs = mobile ? 8 : 10,
      cols = Math.ceil(W / cs) + 1,
      rows = Math.ceil(H / cs) + 1,
      F = new Float32Array(cols * rows),
      nz = this.noise;
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++)
        F[y * cols + x] = nz((x * cs) / 300 + 40, (y * cs) / 300 + 40, 3);
    g.strokeStyle = C.isoline;
    for (let li = 0, lv = 0.28; lv < 0.74; lv += 0.04, li++) {
      g.beginPath();
      g.lineWidth = li % 4 === 0 ? 1.5 : 1;
      for (let y = 0; y < rows - 1; y++)
        for (let x = 0; x < cols - 1; x++) {
          const a = F[y * cols + x],
            b = F[y * cols + x + 1],
            cc = F[(y + 1) * cols + x + 1],
            d = F[(y + 1) * cols + x];
          const idx = (a > lv ? 8 : 0) | (b > lv ? 4 : 0) | (cc > lv ? 2 : 0) | (d > lv ? 1 : 0);
          if (!idx || idx === 15) continue;
          const x0 = x * cs,
            y0 = y * cs,
            E = [
              [x0 + (cs * (lv - a)) / (b - a), y0],
              [x0 + cs, y0 + (cs * (lv - b)) / (cc - b)],
              [x0 + (cs * (lv - d)) / (cc - d), y0 + cs],
              [x0, y0 + (cs * (lv - a)) / (d - a)],
            ];
          for (const [p, q] of MS[idx]) {
            g.moveTo(E[p][0], E[p][1]);
            g.lineTo(E[q][0], E[q][1]);
          }
        }
      g.stroke();
    }
    // районы и улицы — только западный берег
    const westPath = new Path2D();
    this.westPoly.forEach((p, k) =>
      k ? westPath.lineTo(p[0], p[1]) : westPath.moveTo(p[0], p[1]),
    );
    westPath.closePath();
    this._westPath = westPath;
    g.save();
    g.clip(westPath);
    for (const d of this.districts) {
      g.globalAlpha = 0.14;
      g.fillStyle = d.color;
      g.fill(d.path);
    }
    g.globalAlpha = 0.38;
    g.lineWidth = 1;
    for (const d of this.districts) {
      g.strokeStyle = d.color;
      g.stroke(d.path);
    }
    g.globalAlpha = 1;
    g.strokeStyle = C.street;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const n = this.lat.n;
    for (let pass = 0; pass < 2; pass++)
      for (let a = -n; a <= n; a++) {
        const avenue = a % 4 === 0;
        g.lineWidth = avenue ? 2.4 : 1;
        g.beginPath();
        for (let b = -n; b <= n; b++) {
          const p = pass ? this.node(a, b) : this.node(b, a);
          b === -n ? g.moveTo(p[0], p[1]) : g.lineTo(p[0], p[1]);
        }
        g.stroke();
      }
    g.restore();
    // река Тобол
    const { L, R } = this.river,
      rp = new Path2D();
    L.forEach((p, k) => (k ? rp.lineTo(p[0], p[1]) : rp.moveTo(p[0], p[1])));
    for (let k = R.length - 1; k >= 0; k--) rp.lineTo(R[k][0], R[k][1]);
    rp.closePath();
    g.globalAlpha = 0.6;
    g.fillStyle = C.river;
    g.fill(rp);
    g.globalAlpha = 0.85;
    g.strokeStyle = C.river;
    g.lineWidth = 1;
    g.stroke(rp);
    g.globalAlpha = 1;
    // роза ветров
    const cp = this.compass;
    g.strokeStyle = C.border;
    g.lineWidth = 1;
    g.beginPath();
    g.arc(cp.x, cp.y, cp.r, 0, TAU);
    g.stroke();
    g.beginPath();
    g.arc(cp.x, cp.y, cp.r * 0.6, 0, TAU);
    g.stroke();
    const tri = (ax, ay, len, wd, col) => {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(cp.x + ax * len, cp.y + ay * len);
      g.lineTo(cp.x - ay * wd, cp.y + ax * wd);
      g.lineTo(cp.x + ay * wd, cp.y - ax * wd);
      g.closePath();
      g.fill();
    };
    tri(1, 0, cp.r * 0.8, cp.r * 0.14, C.text2);
    tri(-1, 0, cp.r * 0.8, cp.r * 0.14, C.text2);
    tri(0, 1, cp.r * 1.15, cp.r * 0.2, C.text2);
    tri(0, -1, cp.r * 1.25, cp.r * 0.2, C.text);
    g.fillStyle = C.text;
    g.font = `600 9px ${C.display}`;
    g.textAlign = 'center';
    g.fillText(transitionTexts.compassNorth, cp.x, cp.y - cp.r * 1.25 - 5);
    g.textAlign = 'left';
    // едва заметные линии сгибов
    for (let i = 1; i < N; i++) {
      g.fillStyle = `rgba(${C.shade},.32)`;
      g.fillRect(i * w - 0.5, 0, 1, H);
      g.fillStyle = `rgba(${C.light},.035)`;
      g.fillRect(i * w + 0.5, 0, 1, H);
    }
    for (let j = 1; j < M; j++) {
      g.fillStyle = `rgba(${C.shade},.32)`;
      g.fillRect(0, j * h - 0.5, W, 1);
      g.fillStyle = `rgba(${C.light},.035)`;
      g.fillRect(0, j * h + 0.5, W, 1);
    }
    // зерно бумаги
    const t = document.createElement('canvas');
    t.width = t.height = 128;
    const tg = t.getContext('2d'),
      id = tg.createImageData(128, 128),
      rnd = mulberry32(99);
    for (let i = 0; i < 128 * 128; i++) {
      const hi = rnd() > 0.5,
        v = hi ? 255 : 0;
      id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v;
      id.data[i * 4 + 3] = (hi ? 5 : 9) + rnd() * 9;
    }
    tg.putImageData(id, 0, 0);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = g.createPattern(t, 'repeat');
    g.fillRect(0, 0, c.width, c.height);
  }

  _buildSheet() {
    const { N, M, w, h, dpr, W, H } = this;
    this.sheet.textContent = '';
    this.col = Array.from({ length: N }, () => ({ a: 0 }));
    this.row = Array.from({ length: M }, () => ({ a: 0 }));
    this.colEl = [];
    this.rowEl = [];
    this.faces = [];
    let parent = this.sheet;
    for (let i = 0; i < N; i++) {
      const c = el('div', 'vr-mt__hinge vr-mt__hinge--col', parent);
      c.style.cssText = `left:${i ? w : 0}px;top:0;width:${w}px;height:${h}px`;
      this.colEl.push(c);
      this.rowEl[i] = [];
      let rp = c;
      for (let j = 0; j < M; j++) {
        const r = el('div', 'vr-mt__hinge vr-mt__hinge--row', rp);
        r.style.cssText = `left:0;top:${j ? h : 0}px;width:${w}px;height:${h}px`;
        this.rowEl[i].push(r);
        const face = el('div', 'vr-mt__face', r);
        face.style.width = w + 1 + 'px';
        face.style.height = h + 1 + 'px';
        const front = el('div', 'vr-mt__front', face),
          cv = el('canvas', null, front);
        cv.width = Math.ceil((w + 1) * dpr);
        cv.height = Math.ceil((h + 1) * dpr);
        const sx = el('div', 'vr-mt__shade vr-mt__shade--x', front),
          sy = el('div', 'vr-mt__shade vr-mt__shade--y', front),
          sl = el('div', 'vr-mt__shade vr-mt__shade--light', front);
        const back = el('div', 'vr-mt__back', face),
          sb = el('div', 'vr-mt__shade vr-mt__shade--back', back);
        this.faces.push({ i, j, cv, sx, sy, sl, sb, key: '' });
        rp = r;
      }
      parent = c;
    }
    this.shadowEl.style.cssText = `left:${-w / 2}px;top:${-h / 2}px;width:${w}px;height:${h}px`;
    this.stage.style.perspective = Math.round(Math.max(W, H) * 1.35) + 'px';
    this._paintFaces(false);
  }

  _paintFaces(withRoute) {
    const { w, h, dpr, master } = this;
    for (const f of this.faces) {
      const g = f.cv.getContext('2d'),
        sx = Math.round(f.i * w * dpr),
        sy = Math.round(f.j * h * dpr);
      const sw = Math.min(f.cv.width, master.width - sx),
        sh = Math.min(f.cv.height, master.height - sy);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, f.cv.width, f.cv.height);
      g.fillStyle = this.C.paper;
      g.fillRect(0, 0, f.cv.width, f.cv.height);
      g.drawImage(master, sx, sy, sw, sh, 0, 0, sw, sh);
      if (withRoute) {
        g.setTransform(dpr, 0, 0, dpr, -sx, -sy);
        this._drawOverlayTo(g);
      }
    }
  }

  _drawOverlayTo(g) {
    const C = this.C,
      gp = this.gsap.getProperty;
    g.save();
    g.clip(this._westPath);
    for (const d of this.districts) {
      const op = +gp(d.el, 'opacity');
      if (op > 0.01) {
        g.globalAlpha = op;
        g.fillStyle = d.color;
        g.fill(d.path);
      }
    }
    g.restore();
    g.globalAlpha = 1;
    if (this._route) {
      const p = new Path2D(this._route.d);
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.setLineDash([]);
      g.strokeStyle = C.paper;
      g.lineWidth = 7;
      g.stroke(p);
      g.setLineDash([6, 7]);
      g.lineDashOffset = 0;
      g.strokeStyle = C.route;
      g.lineWidth = 2.6;
      g.stroke(p);
      g.setLineDash([]);
    }
    const D = this._dest;
    if (D) {
      g.beginPath();
      g.arc(D.x, D.y, 7, 0, TAU);
      g.fillStyle = C.paper;
      g.fill();
      g.strokeStyle = C.accentHover;
      g.lineWidth = 2;
      g.stroke();
      g.beginPath();
      g.arc(D.x, D.y, 2.5, 0, TAU);
      g.fillStyle = C.text;
      g.fill();
    }
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    for (const q of this._glyphs || []) {
      g.font = q.font;
      g.fillStyle = q.color;
      g.fillText(q.ch, q.x, q.y);
    }
    const r = this._rule;
    if (r) {
      g.fillStyle = r.color;
      g.fillRect(r.x, r.y, r.w, r.h);
    }
  }

  _buildFx() {
    const { W, H } = this,
      id = this._uid;
    const westD = 'M' + this.westPoly.map((p) => f1(p[0]) + ' ' + f1(p[1])).join('L') + 'Z';
    const polys = this.districts
      .map(
        (d, i) =>
          `<polygon class="vr-mt__hl-poly" data-i="${i}" style="fill:var(--district-${d.k + 1})" points="${d.pts.map((p) => f1(p[0]) + ',' + f1(p[1])).join(' ')}"/>`,
      )
      .join('');
    this.fx.setAttribute('width', W);
    this.fx.setAttribute('height', H);
    this.fx.setAttribute('viewBox', `0 0 ${W} ${H}`);
    // Штрих маски белый намеренно: в SVG-маске это «полностью видно», а не цвет.
    this.fx.innerHTML = `<defs><clipPath id="${id}-w"><path d="${westD}"/></clipPath><mask id="${id}-m" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><path class="vr-mt__mask" fill="none" stroke="#fff" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/></mask></defs>
<g class="vr-mt__hl" clip-path="url(#${id}-w)">${polys}</g>
<g class="vr-mt__route" mask="url(#${id}-m)"><path class="vr-mt__route-case"/><path class="vr-mt__route-dash"/></g>
<g class="vr-mt__dest"><circle class="vr-mt__dest-ring" r="7"/><circle class="vr-mt__dest-dot" r="2.5"/></g>
<g class="vr-mt__rings"><ellipse class="vr-mt__ring" rx="100" ry="30" vector-effect="non-scaling-stroke"/><ellipse class="vr-mt__ring" rx="100" ry="30" vector-effect="non-scaling-stroke"/></g>
<g class="vr-mt__pin"><ellipse class="vr-mt__pin-shadow" rx="9" ry="3"/><g class="vr-mt__pin-body"><path class="vr-mt__pin-head" d="M0 0C-3 -8 -13 -15 -13 -26A13 13 0 1 1 13 -26C13 -15 3 -8 0 0Z"/><circle class="vr-mt__pin-eye" cx="0" cy="-26" r="5"/></g></g>`;
    const $ = (s) => this.fx.querySelector(s);
    this.q = {
      hl: $('.vr-mt__hl'),
      route: $('.vr-mt__route'),
      mask: $('.vr-mt__mask'),
      rcase: $('.vr-mt__route-case'),
      rdash: $('.vr-mt__route-dash'),
      dest: $('.vr-mt__dest'),
      ringsG: $('.vr-mt__rings'),
      rings: [...this.fx.querySelectorAll('.vr-mt__ring')],
      pin: $('.vr-mt__pin'),
      pinBody: $('.vr-mt__pin-body'),
      pinShadow: $('.vr-mt__pin-shadow'),
    };
    this.fx.querySelectorAll('.vr-mt__hl-poly').forEach((p) => {
      this.districts[+p.dataset.i].el = p;
    });
    this.labelEl.style.setProperty('--vr-label-size', this.mobile ? '17px' : '24px');
    this._resetFx();
  }

  _resetFx() {
    const g = this.gsap,
      q = this.q;
    if (!q) return;
    q.hl.style.visibility =
      q.route.style.visibility =
      q.dest.style.visibility =
      this.labelEl.style.visibility =
      this.originEl.style.visibility =
        '';
    g.set(
      this.districts.map((d) => d.el),
      { opacity: 0 },
    );
    // Полностью сбрасываем прошлый маршрут: пунктир маски повторяется каждые 2·L, и одного большого
    // смещения пунктира хватило бы, чтобы в начале следующего перехода проступили куски старого
    // маршрута.
    [q.rcase, q.rdash, q.mask].forEach((path) => path.removeAttribute('d'));
    q.mask.removeAttribute('stroke-dasharray');
    g.set(q.mask, { strokeDashoffset: 0 });
    g.set(q.rings, { opacity: 0 });
    g.set(q.pinBody, { y: -2000, opacity: 1, scaleX: 1, scaleY: 1, svgOrigin: '0 0' });
    g.set(q.pinShadow, { opacity: 0, scale: 0.25, svgOrigin: '0 0' });
    g.set(q.dest, { opacity: 0 });
    g.set([this.fx, this.labelEl, this.originEl], { opacity: 1 });
    this._route = null;
  }

  _prepareRoute(label, from) {
    const { W, H } = this,
      g = this.gsap;
    // подпись пункта назначения
    const L = this.labelEl;
    L.textContent = '';
    const O = this.originEl;
    O.textContent = '';
    const cap = el('div', 'vr-mt__label-cap', L),
      name = el('div', 'vr-mt__label-name', L);
    this.ruleEl = el('div', 'vr-mt__label-rule', L);
    const chars = (txt, cls, parent) =>
      [...txt.toUpperCase()].map((ch) => {
        const s = el('span', cls, parent);
        s.textContent = ch === ' ' ? '\u00A0' : ch;
        return s;
      });
    this._capChars = chars(this.opts.caption, 'vr-mt__cch', cap);
    this._nameChars = chars(label || ' ', 'vr-mt__ch', name);
    const oc = from ? chars(from, 'vr-mt__och', el('div', 'vr-mt__label-cap', O)) : [];
    this._originChars = oc;
    this._chars = [...this._capChars, ...this._nameChars, ...oc];
    const bw = L.offsetWidth,
      bh = L.offsetHeight;
    // старт и пункт назначения
    this._S = this.node(0, 0);
    const ow = O.offsetWidth,
      ox = this._S[0] + 14 + ow > W - 12 ? this._S[0] - 14 - ow : this._S[0] + 14;
    O.style.left = ox + 'px';
    O.style.top = this._S[1] + 8 + 'px';
    this._originBox = { x: ox - 6, y: this._S[1] - 40, w: ow + 12, h: 60 };
    const cp = this.compass,
      hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    let dest = null;
    for (let k = 0; k < 120 && !dest; k++) {
      const ang = Math.random() * TAU,
        r = Math.hypot(W, H) * (0.15 + Math.random() * 0.14);
      const [u, v] = this.toLat(W / 2 + Math.cos(ang) * r, H / 2 + Math.sin(ang) * r),
        i = Math.round(u),
        j = Math.round(v);
      if (Math.abs(i) < 2 || Math.abs(j) < 2) continue;
      const [x, y] = this.node(i, j);
      if (!this.west(x, y, 24) || x < 20) continue;
      const right = x + 18 + bw <= W - 16,
        left = x - 18 - bw >= 16;
      if (!right && !left) continue;
      const box = { x: right ? x + 18 : x - 18 - bw, y: y - bh / 2, w: bw, h: bh };
      if (box.y < 24 || box.y + bh > H - 24) continue;
      if (
        hit(box, this._originBox) ||
        hit(box, { x: cp.x - cp.r - 14, y: cp.y - cp.r - 24, w: cp.r * 2 + 28, h: cp.r * 2 + 40 })
      )
        continue;
      dest = { i, j, x, y, box };
    }
    if (!dest) {
      const i = 3,
        j = -2,
        [x, y] = this.node(i, j);
      dest = {
        i,
        j,
        x,
        y,
        box: { x: clamp(x + 18, 16, W - bw - 16), y: clamp(y - bh / 2, 24, H - bh - 24) },
      };
    }
    this._dest = dest;
    this._sig = '';
    L.style.left = dest.box.x + 'px';
    L.style.top = dest.box.y + 'px';
    const q = this.q;
    q.pin.setAttribute('transform', `translate(${f1(this._S[0])} ${f1(this._S[1])})`);
    q.ringsG.setAttribute('transform', `translate(${f1(this._S[0])} ${f1(this._S[1])})`);
    q.dest.querySelectorAll('circle').forEach((c) => {
      c.setAttribute('cx', f1(dest.x));
      c.setAttribute('cy', f1(dest.y));
    });
    g.set(q.dest, { opacity: 0 });
    g.set(q.rings, { svgOrigin: '0 0' });
    g.set([...this._capChars, ...oc], { opacity: 0 });
    g.set(this._nameChars, { opacity: 0, y: -6, scale: 1.25, transformOrigin: '50% 70%' });
    g.set(this.ruleEl, { scaleX: 0 });
  }

  _newRoute() {
    const D = this._dest;
    let pts,
      sig,
      tries = 0;
    do {
      pts = this._manhattan(D, true);
      sig = pts.map((p) => p.join(',')).join(';');
    } while (sig === this._sig && ++tries < 12);
    this._sig = sig;
    const xy = pts.map(([i, j]) => this.node(i, j)),
      cum = [0];
    for (let k = 1; k < xy.length; k++)
      cum.push(cum[k - 1] + Math.hypot(xy[k][0] - xy[k - 1][0], xy[k][1] - xy[k - 1][1]));
    const L = cum[cum.length - 1] + 2,
      d = 'M' + xy.map((p) => f1(p[0]) + ' ' + f1(p[1])).join('L');
    const seq = [];
    xy.forEach((p, k) => {
      if (!this.west(p[0], p[1])) return;
      let bi = 0,
        bd = Infinity;
      this.seeds.forEach((s, n) => {
        const dd = (s[0] - p[0]) ** 2 + (s[1] - p[1]) ** 2;
        if (dd < bd) {
          bd = dd;
          bi = n;
        }
      });
      if (!seq.some((s) => s.d === bi)) seq.push({ d: bi, f: cum[k] / L });
    });
    const q = this.q;
    [q.rcase, q.rdash, q.mask].forEach((p) => p.setAttribute('d', d));
    q.mask.setAttribute('stroke-dasharray', `${L} ${L}`);
    this.gsap.set(q.mask, { strokeDashoffset: L });
    return (this._route = { d, L, seq });
  }

  _startRoute() {
    const g = this.gsap,
      q = this.q,
      tl = this._tl(),
      drop = 0.62,
      hit = drop / 2.75;
    g.set(q.pinBody, { y: -(this._S[1] + 80), opacity: 1 });
    tl.to(q.pinBody, { y: 0, duration: drop, ease: 'bounce.out' }, 0)
      .to(q.pinShadow, { scale: 1, opacity: 0.45, duration: drop, ease: 'bounce.out' }, 0)
      .fromTo(
        q.pinBody,
        { scaleX: 1.1, scaleY: 0.84 },
        { scaleX: 1, scaleY: 1, duration: 0.34, ease: 'back.out(3)', immediateRender: false },
        hit,
      )
      .fromTo(
        q.rings[0],
        { scale: 0.06, opacity: 0.7 },
        { scale: 1.35, opacity: 0, duration: 1, ease: 'power2.out' },
        hit,
      )
      .fromTo(
        q.rings[1],
        { scale: 0.06, opacity: 0.45 },
        { scale: 0.9, opacity: 0, duration: 0.9, ease: 'power2.out' },
        hit + 0.12,
      )
      .to(q.dest, { opacity: 1, duration: 0.3, ease: 'power2.out' }, 0.32)
      .to(this._capChars, { opacity: 1, duration: 0.25, stagger: 0.012, ease: 'none' }, 0.3)
      .to(this._originChars, { opacity: 1, duration: 0.2, stagger: 0.01, ease: 'none' }, hit + 0.05)
      .to(
        this._nameChars,
        { opacity: 1, y: 0, scale: 1, duration: 0.3, stagger: 0.035, ease: 'back.out(2)' },
        0.4,
      )
      .to(this.ruleEl, { scaleX: 1, duration: 0.5, ease: 'power3.inOut' }, 0.45)
      .call(() => this._cycle(true), null, 0.2);
    this._intro = tl;
  }

  _manhattan(D, endVertical) {
    const pts = [[0, 0]];
    let i = 0,
      j = 0,
      ai = Math.abs(D.i),
      aj = Math.abs(D.j);
    const si = Math.sign(D.i),
      sj = Math.sign(D.j);
    const tail = endVertical ? Math.min(aj, 1 + Math.floor(Math.random() * 2)) : 0;
    aj -= tail;
    let axis = Math.random() < 0.5;
    while (ai || aj) {
      if (!ai) axis = false;
      else if (!aj) axis = true;
      const run = Math.min(axis ? ai : aj, 1 + Math.floor(Math.random() * 3));
      for (let k = 0; k < run; k++) {
        if (axis) {
          i += si;
          ai--;
        } else {
          j += sj;
          aj--;
        }
        pts.push([i, j]);
      }
      axis = !axis;
    }
    for (let k = 0; k < tail; k++) {
      j += sj;
      pts.push([i, j]);
    }
    return pts;
  }

  _cycle(first) {
    if (this._state !== 'covered') return;
    // первый маршрут рисуется целиком за минимальные 0.7 с фазы
    const g = this.gsap,
      q = this.q,
      r = this._newRoute(),
      drawDur = first ? 0.55 : clamp(r.L / 560, 0.85, 1.5),
      hold = first ? 1.1 : 0.75,
      erase = 0.65;
    const inv = (ease, f) => {
      let a = 0,
        b = 1;
      for (let k = 0; k < 18; k++) {
        const m = (a + b) / 2;
        ease(m) < f ? (a = m) : (b = m);
      }
      return (a + b) / 2;
    };
    const eIO = g.parseEase('power2.inOut'),
      eIn = g.parseEase('power2.in');
    const tl = this._tl({ onComplete: () => this._cycle() });
    tl.to(q.mask, { strokeDashoffset: 0, duration: drawDur, ease: 'power2.inOut' }, 0);
    r.seq.forEach((s) =>
      tl.to(
        this.districts[s.d].el,
        { opacity: 0.24, duration: 0.5, ease: 'power2.out', overwrite: 'auto' },
        drawDur * inv(eIO, s.f),
      ),
    );
    tl.to(q.mask, { strokeDashoffset: -r.L, duration: erase, ease: 'power2.in' }, drawDur + hold);
    r.seq.forEach((s) =>
      tl.to(
        this.districts[s.d].el,
        { opacity: 0, duration: 0.45, ease: 'power1.inOut', overwrite: 'auto' },
        drawDur + hold + erase * inv(eIn, s.f),
      ),
    );
    tl.to({}, { duration: 0.15 });
    this._loop = tl;
  }

  _captureLabel() {
    const mg = this._mctx || (this._mctx = document.createElement('canvas').getContext('2d')),
      metrics = new Map(),
      out = [];
    for (const s of this._chars) {
      const ch = s.textContent;
      if (!ch.trim()) continue;
      const cs = getComputedStyle(s),
        font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      let m = metrics.get(font);
      if (!m) {
        mg.font = font;
        const t = mg.measureText('НЙg'),
          fs = parseFloat(cs.fontSize);
        m = { A: t.fontBoundingBoxAscent ?? fs * 0.8, D: t.fontBoundingBoxDescent ?? fs * 0.2 };
        metrics.set(font, m);
      }
      const r = s.getBoundingClientRect();
      out.push({
        ch,
        font,
        color: cs.color,
        x: r.left,
        y: r.top + (r.height - (m.A + m.D)) / 2 + m.A,
      });
    }
    const rr = this.ruleEl.getBoundingClientRect();
    this._glyphs = out;
    this._rule = {
      x: rr.left,
      y: rr.top,
      w: rr.width,
      h: rr.height,
      color: getComputedStyle(this.ruleEl).backgroundColor,
    };
  }

  _render() {
    const { N, M, w, h, fl } = this;
    let kx = 1,
      ky = 1;
    const A = [0],
      B = [0];
    for (let i = 1; i < N; i++) {
      const a = this.col[i].a;
      kx += (1 + Math.cos(a * RAD)) / 2;
      A[i] = A[i - 1] + a;
      this.colEl[i].style.transform = `rotateY(${a.toFixed(2)}deg)`;
    }
    for (let j = 1; j < M; j++) {
      const b = this.row[j].a;
      ky += (1 + Math.cos(b * RAD)) / 2;
      B[j] = B[j - 1] + b;
      const t = `rotateX(${b.toFixed(2)}deg)`;
      for (let i = 0; i < N; i++) this.rowEl[i][j].style.transform = t;
    }
    this.sheet.style.transform = `translate3d(${((-kx * w) / 2).toFixed(2)}px,${((-ky * h) / 2).toFixed(2)}px,0)`;
    this.flyer.style.transform = `translate3d(${fl.x.toFixed(2)}px,${fl.y.toFixed(2)}px,0) rotateX(${fl.rx.toFixed(2)}deg) rotateY(${fl.ry.toFixed(2)}deg) rotateZ(${fl.rz.toFixed(2)}deg) scale3d(${fl.s},${fl.s},${fl.s})`;
    this.shadowEl.style.opacity = fl.sh.toFixed(3);
    for (const f of this.faces) {
      const sa = Math.sin(A[f.i] * RAD),
        sb = Math.sin(B[f.j] * RAD);
      const x = sa > 0 ? 0.75 * sa : 0.18 * -sa,
        y = sb < 0 ? 0.75 * -sb : 0.18 * sb,
        l = Math.min(1, Math.max(0, -sa) + Math.max(0, sb)),
        bk = Math.min(0.85, 0.15 + 0.6 * Math.max(0, -sa) + 0.6 * Math.max(0, sb));
      const key = `${x.toFixed(3)}|${y.toFixed(3)}|${l.toFixed(3)}|${bk.toFixed(3)}`;
      if (key === f.key) continue;
      f.key = key;
      f.sx.style.opacity = x.toFixed(3);
      f.sy.style.opacity = y.toFixed(3);
      f.sl.style.opacity = l.toFixed(3);
      f.sb.style.opacity = bk.toFixed(3);
    }
  }
}
