import transitionTexts from '@/texts/en/transition.json';

// Переход между страницами «бумажная карта-оригами». Сложенная карта вылетает из точки клика,
// разворачивается на весь экран, падает метка, и к следующей странице прокладывается маршрут, пока
// она грузится; затем карта складывается и улетает к своей вкладке в таб-баре. Обычный класс поверх
// GSAP; цвета — из CSS-переменных (MapFoldTransition.css → токены).
const TAU = Math.PI * 2,
  DEG_TO_RAD = Math.PI / 180,
  SVG_NS = 'http://www.w3.org/2000/svg';
const FOLD_ANGLE = 179.2;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const createElement = (tag, className, parent) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (parent) parent.appendChild(element);
  return element;
};
const round1 = (number) => number.toFixed(1);

function mulberry32(state) {
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeNoise(seed) {
  const hash = (x, y) => {
    let mixed =
      (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0;
    mixed = Math.imul(mixed ^ (mixed >>> 13), 1274126177);
    mixed ^= mixed >>> 16;
    return (mixed >>> 0) / 4294967296;
  };
  const smoothstep = (t) => t * t * (3 - 2 * t);
  const valueNoise = (x, y) => {
    const cellX = Math.floor(x),
      cellY = Math.floor(y),
      fadeX = smoothstep(x - cellX),
      fadeY = smoothstep(y - cellY);
    const corner00 = hash(cellX, cellY),
      corner10 = hash(cellX + 1, cellY),
      corner01 = hash(cellX, cellY + 1),
      corner11 = hash(cellX + 1, cellY + 1);
    return (
      corner00 +
      (corner10 - corner00) * fadeX +
      (corner01 - corner00) * fadeY +
      (corner00 - corner10 - corner01 + corner11) * fadeX * fadeY
    );
  };
  return (x, y, octaves = 1) => {
    let sum = 0,
      amplitude = 1,
      frequency = 1,
      amplitudeSum = 0;
    for (let octave = 0; octave < octaves; octave++) {
      sum += valueNoise(x * frequency + octave * 17.3, y * frequency + octave * 9.1) * amplitude;
      amplitudeSum += amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }
    return sum / amplitudeSum;
  };
}
function clipHalf(polygon, site, otherSite) {
  const nx = otherSite[0] - site[0],
    ny = otherSite[1] - site[1],
    midX = (site[0] + otherSite[0]) / 2,
    midY = (site[1] + otherSite[1]) / 2,
    side = (point) => (point[0] - midX) * nx + (point[1] - midY) * ny,
    clipped = [];
  for (let i = 0; i < polygon.length; i++) {
    const start = polygon[i],
      end = polygon[(i + 1) % polygon.length],
      startSide = side(start),
      endSide = side(end);
    if (startSide <= 0) clipped.push(start);
    if (startSide <= 0 !== endSide <= 0) {
      const t = startSide / (startSide - endSide);
      clipped.push([start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t]);
    }
  }
  return clipped;
}
const MARCHING_SQUARE_SEGMENTS = {
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
    this._svgIdPrefix = 'map-fold-' + Math.random().toString(36).slice(2, 8);
    this._state = 'idle';
    this._timelines = new Set();
    this._reducedMotionQuery = matchMedia('(prefers-reduced-motion: reduce)');
    this._buildRoot();
    this._onResize = () => {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => {
        if (this._state === 'idle') this._ready = this._layout();
        else this._dirty = true;
      }, 180);
    };
    this._onVisibilityChange = () =>
      this._timelines.forEach((t) => (document.hidden ? t.pause() : t.resume()));
    addEventListener('resize', this._onResize);
    document.addEventListener('visibilitychange', this._onVisibilityChange);
    this._ready = this._layout();
  }

  get reduced() {
    const setting = this.opts.reducedMotion;
    return setting === 'auto' ? this._reducedMotionQuery.matches : !!setting;
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
        this.width !== (document.documentElement.clientWidth || innerWidth) ||
        this.height !== innerHeight ||
        !this._stylesReady()
      ) {
        this._ready = this._layout();
        await this._ready;
      }
      const { width, height } = this;
      this._target = targetRect;
      this._paintFaces(false);
      this._resetRouteLayer();
      this._prepareRoute(label, fromLabel);
      this.el.classList.add('is-active');
      if (this.reduced) return this._coverReduced();
      const gsap = this.gsap,
        flight = this.flight,
        startScale = this.opts.packetSize / Math.max(this.cellWidth, this.cellHeight);
      Object.assign(flight, {
        x: x ?? width / 2,
        y: y ?? height / 2,
        scale: startScale,
        rotateZ: -28,
        rotateX: 28,
        rotateY: -18,
        shadow: 1,
      });
      this.columnHinges.forEach(
        (hinge, i) => (hinge.angle = i ? (i % 2 ? -FOLD_ANGLE : FOLD_ANGLE) : 0),
      );
      this.rowHinges.forEach(
        (hinge, j) => (hinge.angle = j ? (j % 2 ? FOLD_ANGLE : -FOLD_ANGLE) : 0),
      );
      gsap.set(this.stage, { opacity: 1 });
      this._render();
      const timeline = this._timeline({ onUpdate: () => this._render() });
      const from = { x: flight.x, y: flight.y },
        center = { x: width / 2, y: height / 2 },
        control = { x: (from.x + center.x) / 2, y: Math.min(from.y, center.y) - height * 0.2 },
        progress = { t: 0 };
      timeline
        .to(
          progress,
          {
            t: 1,
            duration: 0.34,
            ease: 'power2.inOut',
            onUpdate: () => {
              const t = progress.t,
                remaining = 1 - t;
              flight.x =
                remaining * remaining * from.x + 2 * remaining * t * control.x + t * t * center.x;
              flight.y =
                remaining * remaining * from.y + 2 * remaining * t * control.y + t * t * center.y;
            },
          },
          0,
        )
        .to(flight, { scale: 0.8, duration: 0.34, ease: 'power2.in' }, 0)
        .to(
          flight,
          { rotateZ: 0, rotateX: 0, rotateY: 0, duration: 0.44, ease: 'back.out(1.8)' },
          0.1,
        )
        .to(flight, { scale: 1, duration: 0.42, ease: 'power3.out' }, 0.34)
        .to(flight, { shadow: 0, duration: 0.3, ease: 'power1.in' }, 0.36);
      for (let i = 1; i < this.columnCount; i++)
        timeline.to(
          this.columnHinges[i],
          { angle: 0, duration: 0.22, ease: 'back.out(1.1)' },
          0.24 + (i - 1) * 0.06,
        );
      const rowStart = 0.24 + (this.columnCount - 2) * 0.06 + 0.1;
      for (let j = 1; j < this.rowCount; j++)
        timeline.to(
          this.rowHinges[j],
          { angle: 0, duration: 0.24, ease: 'back.out(1.1)' },
          rowStart + (j - 1) * 0.07,
        );
      await timeline._done;
      this._onCovered();
    })();
    return this._coverPromise;
  }

  async waitFor(promise) {
    await this._coverPromise;
    const results = await Promise.allSettled([Promise.resolve(promise), this._minTime()]);
    if (results[0].status === 'rejected') throw results[0].reason;
    return results[0].value;
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
      const gsap = this.gsap;
      if (this.reduced) {
        onFold?.();
        const timeline = this._timeline();
        timeline.to(this.stage, { opacity: 0, duration: 0.2, ease: 'none' }, 0);
        timeline.to(
          [this.routeLayer, this.labelEl, this.originEl],
          { opacity: 0, duration: 0.2 },
          0,
        );
        if (page)
          timeline.fromTo(
            page,
            { opacity: 0 },
            { opacity: 1, duration: 0.2, clearProps: 'opacity' },
            0,
          );
        await timeline._done;
        return this._finishReveal();
      }
      this._killTimeline(this._routeLoop);
      this._killTimeline(this._routeIntro);
      const parts = this.parts,
        settle = this._timeline();
      settle
        .to(parts.pinBody, { y: 0, scaleX: 1, scaleY: 1, duration: 0.2, ease: 'power2.out' }, 0)
        .to(parts.pinShadow, { scale: 1, opacity: 0.45, duration: 0.2 }, 0)
        .to(this._labelChars, { opacity: 1, y: 0, scale: 1, duration: 0.2, stagger: 0.008 }, 0)
        .to(this.ruleEl, { scaleX: 1, duration: 0.2 }, 0)
        .to(parts.dest, { opacity: 1, duration: 0.2 }, 0)
        .to(parts.rings, { opacity: 0, duration: 0.15 }, 0)
        .to(parts.mask, { strokeDashoffset: 0, duration: 0.28, ease: 'power2.out' }, 0);
      (this._route?.steps || []).forEach((step) =>
        settle.to(
          this.districts[step.district].el,
          { opacity: 0.24, duration: 0.28, overwrite: 'auto' },
          0,
        ),
      );
      await settle._done;
      // «Печатаем» маршрут на бумагу и складываем его вместе с картой
      this._captureLabel();
      this._paintFaces(true);
      parts.highlights.style.visibility =
        parts.route.style.visibility =
        parts.dest.style.visibility =
        this.labelEl.style.visibility =
        this.originEl.style.visibility =
          'hidden';
      onFold?.();
      if (page) gsap.set(page, { opacity: 0, y: 16 });
      const flight = this.flight,
        { width, height } = this,
        timeline = this._timeline({ onUpdate: () => this._render() });
      timeline
        .to(parts.pinBody, { y: -46, opacity: 0, duration: 0.2, ease: 'power2.in' }, 0)
        .to(parts.pinShadow, { opacity: 0, duration: 0.15 }, 0);
      let t = 0.05;
      for (let j = this.rowCount - 1; j >= 1; j--, t += 0.05)
        timeline.to(
          this.rowHinges[j],
          { angle: j % 2 ? FOLD_ANGLE : -FOLD_ANGLE, duration: 0.18, ease: 'power3.inOut' },
          t,
        );
      t = t - 0.05 + 0.15;
      for (let i = this.columnCount - 1; i >= 1; i--, t += 0.04)
        timeline.to(
          this.columnHinges[i],
          { angle: i % 2 ? -FOLD_ANGLE : FOLD_ANGLE, duration: 0.18, ease: 'power3.inOut' },
          t,
        );
      const foldEnd = t - 0.04 + 0.18;
      timeline
        .to(flight, { scale: 0.62, duration: foldEnd - 0.1, ease: 'power2.inOut' }, 0.1)
        .to(flight, { shadow: 1, duration: 0.2 }, foldEnd - 0.2);
      const tabRect = this._target,
        tx = tabRect ? tabRect.left + tabRect.width / 2 : width / 2,
        ty = tabRect ? tabRect.top + tabRect.height / 2 : -80;
      const endScale =
        (tabRect ? clamp(tabRect.height, 18, 40) : 24) / Math.max(this.cellWidth, this.cellHeight);
      const from = { x: width / 2, y: height / 2 },
        control = {
          x: (from.x + tx) / 2 + (tx - from.x) * 0.15,
          y: Math.min(from.y, ty) + (from.y - ty) * 0.15,
        },
        progress = { t: 0 },
        flightDuration = 0.32,
        flightStart = foldEnd - 0.06;
      timeline
        .to(
          progress,
          {
            t: 1,
            duration: flightDuration,
            ease: 'power2.in',
            onUpdate: () => {
              const along = progress.t,
                remaining = 1 - along;
              flight.x =
                remaining * remaining * from.x +
                2 * remaining * along * control.x +
                along * along * tx;
              flight.y =
                remaining * remaining * from.y +
                2 * remaining * along * control.y +
                along * along * ty;
            },
          },
          flightStart,
        )
        .to(
          flight,
          {
            scale: endScale,
            rotateZ: -20,
            rotateX: 26,
            rotateY: 12,
            duration: flightDuration,
            ease: 'power2.in',
          },
          flightStart,
        )
        .to(
          this.stage,
          { opacity: 0, duration: 0.1, ease: 'none' },
          flightStart + flightDuration - 0.1,
        );
      if (page)
        timeline.to(
          page,
          { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', clearProps: 'transform,opacity' },
          0.12,
        );
      await timeline._done;
      this._finishReveal();
    })();
    return this._revealPromise;
  }

  dispose() {
    this._timelines.forEach((t) => t.kill());
    this._timelines.clear();
    removeEventListener('resize', this._onResize);
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
    clearTimeout(this._resizeTimer);
    (this.faces || []).forEach((face) => {
      face.canvas.width = face.canvas.height = 0;
    });
    if (this.paperCanvas) this.paperCanvas.width = this.paperCanvas.height = 0;
    this.el.remove();
    this._state = 'disposed';
  }

  // ─── Внутреннее ──────────────────────────────────────────
  _timeline(vars = {}) {
    let resolveDone;
    const done = new Promise((resolve) => (resolveDone = resolve));
    const timeline = this.gsap.timeline({
      ...vars,
      onComplete: () => {
        this._timelines.delete(timeline);
        vars.onComplete && vars.onComplete();
        resolveDone();
      },
    });
    timeline._done = done;
    timeline.timeScale(1 / (this.opts.durationScale || 1));
    this._timelines.add(timeline);
    return timeline;
  }
  _killTimeline(timeline) {
    if (timeline) {
      timeline.kill();
      this._timelines.delete(timeline);
    }
  }
  _stylesReady() {
    const stylesApplied =
      getComputedStyle(this.el).visibility === 'hidden' &&
      getComputedStyle(this.el).pointerEvents === 'none';
    return stylesApplied ? (this._stylesSeen ? true : ((this._stylesSeen = true), false)) : true;
  }
  _minTime() {
    const waitMs =
      this.opts.minRouteTime * 1000 * (this.opts.durationScale || 1) -
      (performance.now() - (this._routeStart || 0));
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, waitMs)));
  }

  _onCovered() {
    this._state = 'covered';
    this._routeStart = performance.now();
    if (!this.reduced) this._startRoute();
  }

  _coverReduced() {
    const { width, height } = this,
      gsap = this.gsap;
    Object.assign(this.flight, {
      x: width / 2,
      y: height / 2,
      scale: 1,
      rotateZ: 0,
      rotateX: 0,
      rotateY: 0,
      shadow: 0,
    });
    this.columnHinges.forEach((hinge) => (hinge.angle = 0));
    this.rowHinges.forEach((hinge) => (hinge.angle = 0));
    this._render();
    const parts = this.parts,
      route = this._newRoute();
    gsap.set(parts.mask, { strokeDashoffset: 0 });
    route.steps.forEach((step) => gsap.set(this.districts[step.district].el, { opacity: 0.24 }));
    gsap.set(parts.dest, { opacity: 1 });
    gsap.set(this._labelChars, { opacity: 1, y: 0, scale: 1 });
    gsap.set(this.ruleEl, { scaleX: 1 });
    gsap.set([parts.pinBody], { y: 0, opacity: 1 });
    gsap.set(parts.pinShadow, { opacity: 0.45, scale: 1 });
    gsap.set([this.routeLayer, this.labelEl], { opacity: 1 });
    const timeline = this._timeline();
    timeline
      .fromTo(this.stage, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'none' }, 0)
      .fromTo(
        [this.routeLayer, this.labelEl, this.originEl],
        { opacity: 0 },
        { opacity: 1, duration: 0.2, ease: 'none' },
        0,
      );
    return timeline._done.then(() => this._onCovered());
  }

  _finishReveal() {
    this.el.classList.remove('is-active');
    this._resetRouteLayer();
    this._state = 'idle';
    if (this._dirty) this._ready = this._layout();
  }

  _buildRoot() {
    this.el = createElement('div', 'map-fold');
    this.el.setAttribute('aria-hidden', 'true');
    this.el.style.cssText = `position:fixed;inset:0;overflow:hidden;z-index:${this.opts.zIndex}`;
    this.stage = createElement('div', 'map-fold__stage', this.el);
    this.flyer = createElement('div', 'map-fold__flyer', this.stage);
    this.shadowEl = createElement('div', 'map-fold__shadow', this.flyer);
    this.sheet = createElement('div', 'map-fold__sheet', this.flyer);
    this.routeLayer = document.createElementNS(SVG_NS, 'svg');
    this.routeLayer.setAttribute('class', 'map-fold__route-layer');
    this.el.appendChild(this.routeLayer);
    this.labelEl = createElement('div', 'map-fold__label', this.el);
    this.originEl = createElement('div', 'map-fold__label map-fold__origin', this.el);
    this.flight = { x: 0, y: 0, scale: 1, rotateZ: 0, rotateX: 0, rotateY: 0, shadow: 0 };
    this.opts.container.appendChild(this.el);
  }

  async _loadFonts() {
    if (!document.fonts) return;
    const specs = [
      '600 24px Unbounded',
      '600 11px Unbounded',
      '500 10px Manrope',
      '600 10px Manrope',
    ];
    await Promise.race([
      Promise.all(specs.map((spec) => document.fonts.load(spec).catch(() => {}))),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
  }

  // Каждый цвет — CSS-переменная на оверлее (MapFoldTransition.css связывает их с токенами).
  _readColors() {
    const style = getComputedStyle(this.el);
    const cssValue = (name) => style.getPropertyValue(name).trim();
    return {
      bg: cssValue('--color-bg'),
      paper: cssValue('--color-paper'),
      paper2: cssValue('--color-paper-2'),
      border: cssValue('--color-border'),
      isoline: cssValue('--color-isoline'),
      street: cssValue('--color-street'),
      accent: cssValue('--color-accent'),
      accentHover: cssValue('--color-accent-hover'),
      text: cssValue('--color-text'),
      text2: cssValue('--color-text-2'),
      river: cssValue('--color-river'),
      route: cssValue('--color-route'),
      shade: cssValue('--color-shade'),
      light: cssValue('--color-light'),
      display: cssValue('--map-fold-font-display'),
      textFont: cssValue('--map-fold-font-text'),
      districts: Array.from({ length: 12 }, (_, index) => cssValue(`--district-${index + 1}`)),
    };
  }

  async _layout() {
    await (this._fontsReady ||= this._loadFonts());
    const width = document.documentElement.clientWidth || innerWidth,
      height = innerHeight;
    // Окно нулевого размера (свёрнутая или скрытая вкладка): карту построим перед переходом.
    if (!width || !height) {
      this._dirty = true;
      return;
    }
    const pixelRatio = Math.min(this.opts.dprCap, devicePixelRatio || 1),
      mobile = width < 640;
    let columnCount, rowCount;
    if (mobile) {
      const wideRatio = width / 3 / (height / 2),
        tallRatio = width / 2 / (height / 3);
      [columnCount, rowCount] =
        Math.abs(Math.log(wideRatio)) <= Math.abs(Math.log(tallRatio)) ? [3, 2] : [2, 3];
    } else {
      rowCount = 3;
      columnCount = clamp(Math.round(width / (height / rowCount)), 4, 6);
    }
    Object.assign(this, {
      width,
      height,
      pixelRatio,
      columnCount,
      rowCount,
      cellWidth: width / columnCount,
      cellHeight: height / rowCount,
      mobile,
    });
    this.colors = this._readColors();
    if (getComputedStyle(this.el).visibility === 'hidden') this._stylesSeen = true;
    this._buildMap();
    this._paintPaper();
    this._buildSheet();
    this._buildRouteLayer();
    this._dirty = false;
  }

  _buildMap() {
    const { width, height, mobile } = this,
      random = mulberry32(this.opts.seed),
      noise = makeNoise(this.opts.seed);
    const riverX = width * (mobile ? 0.9 : 0.875),
      ramp = width * (mobile ? 0.028 : 0.032),
      phase = random() * TAU;
    const riverCenterAt = (y) =>
      riverX +
      Math.sin((y / height) * TAU * 1.15 + phase) * ramp +
      (noise(3.1, y / 240) - 0.5) * ramp * 1.6;
    const riverWidthAt = (y) => (mobile ? 8 : 13) + noise(7.7, y / 320) * (mobile ? 6 : 12);
    const leftBank = [],
      rightBank = [];
    for (let y = -24; y <= height + 24; y += 8) {
      const center = riverCenterAt(y),
        halfWidth = riverWidthAt(y) / 2;
      leftBank.push([center - halfWidth, y]);
      rightBank.push([center + halfWidth, y]);
    }
    this.river = { left: leftBank, right: rightBank };
    this.westBankPolygon = [[-40, -24], ...leftBank, [-40, height + 24]];
    this.isWestOfRiver = (x, y, margin = 0) => x < riverCenterAt(y) - riverWidthAt(y) / 2 - margin;
    const seeds = [];
    for (let k = 0; k < 15; k++) {
      let best = null,
        bestDistance = -1;
      for (let attempt = 0; attempt < 28; attempt++) {
        const y = height * (0.04 + 0.92 * random()),
          x = width * 0.03 + (riverCenterAt(y) - width * 0.07) * random();
        let distance = Infinity;
        for (const seed of seeds)
          distance = Math.min(distance, Math.hypot(seed[0] - x, seed[1] - y));
        if (distance > bestDistance) {
          bestDistance = distance;
          best = [x, y];
        }
      }
      seeds.push(best);
    }
    this.districtSeeds = seeds;
    const bounds = [
        [-40, -40],
        [width + 40, -40],
        [width + 40, height + 40],
        [-40, height + 40],
      ],
      warpAmount = mobile ? 5 : 8;
    const warp = (x, y) => [
      x + (noise(x / 90 + 11, y / 90) - 0.5) * 2 * warpAmount,
      y + (noise(x / 90, y / 90 + 23) - 0.5) * 2 * warpAmount,
    ];
    this.districts = seeds.map((seed, i) => {
      let polygon = bounds;
      seeds.forEach((other, j) => {
        if (j !== i) polygon = clipHalf(polygon, seed, other);
      });
      const points = [];
      for (let edgeIndex = 0; edgeIndex < polygon.length; edgeIndex++) {
        const start = polygon[edgeIndex],
          end = polygon[(edgeIndex + 1) % polygon.length],
          steps = Math.max(1, Math.ceil(Math.hypot(end[0] - start[0], end[1] - start[1]) / 12));
        for (let t = 0; t < steps; t++)
          points.push(
            warp(
              start[0] + ((end[0] - start[0]) * t) / steps,
              start[1] + ((end[1] - start[1]) * t) / steps,
            ),
          );
      }
      const path = new Path2D();
      points.forEach((point, k) =>
        k ? path.lineTo(point[0], point[1]) : path.moveTo(point[0], point[1]),
      );
      path.closePath();
      return { points, path, paletteIndex: i % 12, color: this.colors.districts[i % 12] };
    });
    const gridStep = mobile ? 44 : 62,
      rotation = -0.11,
      cosRotation = Math.cos(rotation),
      sinRotation = Math.sin(rotation),
      cx = width / 2,
      cy = height / 2,
      jitter = gridStep * 0.16;
    this.streetGrid = {
      step: gridStep,
      halfCount: Math.ceil(Math.hypot(width, height) / 2 / gridStep) + 2,
    };
    this.gridPoint = (i, j) => {
      const bx = i * gridStep,
        by = j * gridStep,
        gridX = cx + bx * cosRotation - by * sinRotation,
        gridY = cy + bx * sinRotation + by * cosRotation;
      return [
        gridX + (noise(gridX / 160 + 5, gridY / 160) - 0.5) * 2 * jitter,
        gridY + (noise(gridX / 160, gridY / 160 + 9) - 0.5) * 2 * jitter,
      ];
    };
    this.toGrid = (x, y) => {
      const dx = x - cx,
        dy = y - cy;
      return [
        (dx * cosRotation + dy * sinRotation) / gridStep,
        (-dx * sinRotation + dy * cosRotation) / gridStep,
      ];
    };
    this.compass = mobile ? { x: 34, y: 92, radius: 15 } : { x: width - 46, y: 104, radius: 20 };
    this.noise = noise;
  }

  _paintPaper() {
    const {
      width,
      height,
      pixelRatio,
      colors,
      mobile,
      columnCount,
      rowCount,
      cellWidth,
      cellHeight,
    } = this;
    const canvas = this.paperCanvas || (this.paperCanvas = document.createElement('canvas'));
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    const paint = canvas.getContext('2d');
    paint.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    paint.fillStyle = colors.paper;
    paint.fillRect(0, 0, width, height);
    const vignette = paint.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.2,
      width / 2,
      height / 2,
      Math.hypot(width, height) * 0.6,
    );
    vignette.addColorStop(0, `rgba(${colors.shade},0)`);
    vignette.addColorStop(1, `rgba(${colors.shade},.28)`);
    paint.fillStyle = vignette;
    paint.fillRect(0, 0, width, height);
    // изолинии (marching squares)
    const cellSize = mobile ? 8 : 10,
      cols = Math.ceil(width / cellSize) + 1,
      rows = Math.ceil(height / cellSize) + 1,
      field = new Float32Array(cols * rows),
      noise = this.noise;
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++)
        field[y * cols + x] = noise((x * cellSize) / 300 + 40, (y * cellSize) / 300 + 40, 3);
    paint.strokeStyle = colors.isoline;
    for (let levelIndex = 0, level = 0.28; level < 0.74; level += 0.04, levelIndex++) {
      paint.beginPath();
      paint.lineWidth = levelIndex % 4 === 0 ? 1.5 : 1;
      for (let y = 0; y < rows - 1; y++)
        for (let x = 0; x < cols - 1; x++) {
          const topLeft = field[y * cols + x],
            topRight = field[y * cols + x + 1],
            bottomRight = field[(y + 1) * cols + x + 1],
            bottomLeft = field[(y + 1) * cols + x];
          const caseIndex =
            (topLeft > level ? 8 : 0) |
            (topRight > level ? 4 : 0) |
            (bottomRight > level ? 2 : 0) |
            (bottomLeft > level ? 1 : 0);
          if (!caseIndex || caseIndex === 15) continue;
          const x0 = x * cellSize,
            y0 = y * cellSize,
            edges = [
              [x0 + (cellSize * (level - topLeft)) / (topRight - topLeft), y0],
              [x0 + cellSize, y0 + (cellSize * (level - topRight)) / (bottomRight - topRight)],
              [x0 + (cellSize * (level - bottomLeft)) / (bottomRight - bottomLeft), y0 + cellSize],
              [x0, y0 + (cellSize * (level - topLeft)) / (bottomLeft - topLeft)],
            ];
          for (const [segmentStart, segmentEnd] of MARCHING_SQUARE_SEGMENTS[caseIndex]) {
            paint.moveTo(edges[segmentStart][0], edges[segmentStart][1]);
            paint.lineTo(edges[segmentEnd][0], edges[segmentEnd][1]);
          }
        }
      paint.stroke();
    }
    // районы и улицы — только западный берег
    const westPath = new Path2D();
    this.westBankPolygon.forEach((point, k) =>
      k ? westPath.lineTo(point[0], point[1]) : westPath.moveTo(point[0], point[1]),
    );
    westPath.closePath();
    this._westBankPath = westPath;
    paint.save();
    paint.clip(westPath);
    for (const d of this.districts) {
      paint.globalAlpha = 0.14;
      paint.fillStyle = d.color;
      paint.fill(d.path);
    }
    paint.globalAlpha = 0.38;
    paint.lineWidth = 1;
    for (const d of this.districts) {
      paint.strokeStyle = d.color;
      paint.stroke(d.path);
    }
    paint.globalAlpha = 1;
    paint.strokeStyle = colors.street;
    paint.lineCap = 'round';
    paint.lineJoin = 'round';
    const halfCount = this.streetGrid.halfCount;
    for (let pass = 0; pass < 2; pass++)
      for (let lineIndex = -halfCount; lineIndex <= halfCount; lineIndex++) {
        const avenue = lineIndex % 4 === 0;
        paint.lineWidth = avenue ? 2.4 : 1;
        paint.beginPath();
        for (let pointIndex = -halfCount; pointIndex <= halfCount; pointIndex++) {
          const point = pass
            ? this.gridPoint(lineIndex, pointIndex)
            : this.gridPoint(pointIndex, lineIndex);
          pointIndex === -halfCount
            ? paint.moveTo(point[0], point[1])
            : paint.lineTo(point[0], point[1]);
        }
        paint.stroke();
      }
    paint.restore();
    // река Тобол
    const { left: leftBank, right: rightBank } = this.river,
      riverPath = new Path2D();
    leftBank.forEach((point, k) =>
      k ? riverPath.lineTo(point[0], point[1]) : riverPath.moveTo(point[0], point[1]),
    );
    for (let k = rightBank.length - 1; k >= 0; k--)
      riverPath.lineTo(rightBank[k][0], rightBank[k][1]);
    riverPath.closePath();
    paint.globalAlpha = 0.6;
    paint.fillStyle = colors.river;
    paint.fill(riverPath);
    paint.globalAlpha = 0.85;
    paint.strokeStyle = colors.river;
    paint.lineWidth = 1;
    paint.stroke(riverPath);
    paint.globalAlpha = 1;
    // роза ветров
    const compass = this.compass;
    paint.strokeStyle = colors.border;
    paint.lineWidth = 1;
    paint.beginPath();
    paint.arc(compass.x, compass.y, compass.radius, 0, TAU);
    paint.stroke();
    paint.beginPath();
    paint.arc(compass.x, compass.y, compass.radius * 0.6, 0, TAU);
    paint.stroke();
    const drawNeedle = (ax, ay, length, halfWidth, color) => {
      paint.fillStyle = color;
      paint.beginPath();
      paint.moveTo(compass.x + ax * length, compass.y + ay * length);
      paint.lineTo(compass.x - ay * halfWidth, compass.y + ax * halfWidth);
      paint.lineTo(compass.x + ay * halfWidth, compass.y - ax * halfWidth);
      paint.closePath();
      paint.fill();
    };
    drawNeedle(1, 0, compass.radius * 0.8, compass.radius * 0.14, colors.text2);
    drawNeedle(-1, 0, compass.radius * 0.8, compass.radius * 0.14, colors.text2);
    drawNeedle(0, 1, compass.radius * 1.15, compass.radius * 0.2, colors.text2);
    drawNeedle(0, -1, compass.radius * 1.25, compass.radius * 0.2, colors.text);
    paint.fillStyle = colors.text;
    paint.font = `600 9px ${colors.display}`;
    paint.textAlign = 'center';
    paint.fillText(transitionTexts.compassNorth, compass.x, compass.y - compass.radius * 1.25 - 5);
    paint.textAlign = 'left';
    // едва заметные линии сгибов
    for (let i = 1; i < columnCount; i++) {
      paint.fillStyle = `rgba(${colors.shade},.32)`;
      paint.fillRect(i * cellWidth - 0.5, 0, 1, height);
      paint.fillStyle = `rgba(${colors.light},.035)`;
      paint.fillRect(i * cellWidth + 0.5, 0, 1, height);
    }
    for (let j = 1; j < rowCount; j++) {
      paint.fillStyle = `rgba(${colors.shade},.32)`;
      paint.fillRect(0, j * cellHeight - 0.5, width, 1);
      paint.fillStyle = `rgba(${colors.light},.035)`;
      paint.fillRect(0, j * cellHeight + 0.5, width, 1);
    }
    // зерно бумаги
    const grainCanvas = document.createElement('canvas');
    grainCanvas.width = grainCanvas.height = 128;
    const grainPaint = grainCanvas.getContext('2d'),
      pixels = grainPaint.createImageData(128, 128),
      random = mulberry32(99);
    for (let i = 0; i < 128 * 128; i++) {
      const light = random() > 0.5,
        channel = light ? 255 : 0;
      pixels.data[i * 4] = pixels.data[i * 4 + 1] = pixels.data[i * 4 + 2] = channel;
      pixels.data[i * 4 + 3] = (light ? 5 : 9) + random() * 9;
    }
    grainPaint.putImageData(pixels, 0, 0);
    paint.setTransform(1, 0, 0, 1, 0, 0);
    paint.fillStyle = paint.createPattern(grainCanvas, 'repeat');
    paint.fillRect(0, 0, canvas.width, canvas.height);
  }

  _buildSheet() {
    const { columnCount, rowCount, cellWidth, cellHeight, pixelRatio, width, height } = this;
    this.sheet.textContent = '';
    this.columnHinges = Array.from({ length: columnCount }, () => ({ angle: 0 }));
    this.rowHinges = Array.from({ length: rowCount }, () => ({ angle: 0 }));
    this.columnElements = [];
    this.rowElements = [];
    this.faces = [];
    let parent = this.sheet;
    for (let i = 0; i < columnCount; i++) {
      const column = createElement('div', 'map-fold__hinge map-fold__hinge--column', parent);
      column.style.cssText = `left:${i ? cellWidth : 0}px;top:0;width:${cellWidth}px;height:${cellHeight}px`;
      this.columnElements.push(column);
      this.rowElements[i] = [];
      let parentRow = column;
      for (let j = 0; j < rowCount; j++) {
        const row = createElement('div', 'map-fold__hinge map-fold__hinge--row', parentRow);
        row.style.cssText = `left:0;top:${j ? cellHeight : 0}px;width:${cellWidth}px;height:${cellHeight}px`;
        this.rowElements[i].push(row);
        const face = createElement('div', 'map-fold__face', row);
        face.style.width = cellWidth + 1 + 'px';
        face.style.height = cellHeight + 1 + 'px';
        const front = createElement('div', 'map-fold__front', face),
          canvas = createElement('canvas', null, front);
        canvas.width = Math.ceil((cellWidth + 1) * pixelRatio);
        canvas.height = Math.ceil((cellHeight + 1) * pixelRatio);
        const shadeX = createElement('div', 'map-fold__shade map-fold__shade--x', front),
          shadeY = createElement('div', 'map-fold__shade map-fold__shade--y', front),
          shadeLight = createElement('div', 'map-fold__shade map-fold__shade--light', front);
        const back = createElement('div', 'map-fold__back', face),
          shadeBack = createElement('div', 'map-fold__shade map-fold__shade--back', back);
        this.faces.push({ i, j, canvas, shadeX, shadeY, shadeLight, shadeBack, key: '' });
        parentRow = row;
      }
      parent = column;
    }
    this.shadowEl.style.cssText = `left:${-cellWidth / 2}px;top:${-cellHeight / 2}px;width:${cellWidth}px;height:${cellHeight}px`;
    this.stage.style.perspective = Math.round(Math.max(width, height) * 1.35) + 'px';
    this._paintFaces(false);
  }

  _paintFaces(withRoute) {
    const { cellWidth, cellHeight, pixelRatio, paperCanvas } = this;
    for (const face of this.faces) {
      const paint = face.canvas.getContext('2d'),
        sourceX = Math.round(face.i * cellWidth * pixelRatio),
        sourceY = Math.round(face.j * cellHeight * pixelRatio);
      const sourceWidth = Math.min(face.canvas.width, paperCanvas.width - sourceX),
        sourceHeight = Math.min(face.canvas.height, paperCanvas.height - sourceY);
      paint.setTransform(1, 0, 0, 1, 0, 0);
      paint.clearRect(0, 0, face.canvas.width, face.canvas.height);
      paint.fillStyle = this.colors.paper;
      paint.fillRect(0, 0, face.canvas.width, face.canvas.height);
      paint.drawImage(
        paperCanvas,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        sourceWidth,
        sourceHeight,
      );
      if (withRoute) {
        paint.setTransform(pixelRatio, 0, 0, pixelRatio, -sourceX, -sourceY);
        this._drawOverlayTo(paint);
      }
    }
  }

  _drawOverlayTo(paint) {
    const colors = this.colors,
      getProperty = this.gsap.getProperty;
    paint.save();
    paint.clip(this._westBankPath);
    for (const d of this.districts) {
      const opacity = +getProperty(d.el, 'opacity');
      if (opacity > 0.01) {
        paint.globalAlpha = opacity;
        paint.fillStyle = d.color;
        paint.fill(d.path);
      }
    }
    paint.restore();
    paint.globalAlpha = 1;
    if (this._route) {
      const routePath = new Path2D(this._route.d);
      paint.lineCap = 'round';
      paint.lineJoin = 'round';
      paint.setLineDash([]);
      paint.strokeStyle = colors.paper;
      paint.lineWidth = 7;
      paint.stroke(routePath);
      paint.setLineDash([6, 7]);
      paint.lineDashOffset = 0;
      paint.strokeStyle = colors.route;
      paint.lineWidth = 2.6;
      paint.stroke(routePath);
      paint.setLineDash([]);
    }
    const destination = this._destination;
    if (destination) {
      paint.beginPath();
      paint.arc(destination.x, destination.y, 7, 0, TAU);
      paint.fillStyle = colors.paper;
      paint.fill();
      paint.strokeStyle = colors.accentHover;
      paint.lineWidth = 2;
      paint.stroke();
      paint.beginPath();
      paint.arc(destination.x, destination.y, 2.5, 0, TAU);
      paint.fillStyle = colors.text;
      paint.fill();
    }
    paint.textAlign = 'left';
    paint.textBaseline = 'alphabetic';
    for (const glyph of this._glyphs || []) {
      paint.font = glyph.font;
      paint.fillStyle = glyph.color;
      paint.fillText(glyph.character, glyph.x, glyph.y);
    }
    const rule = this._rule;
    if (rule) {
      paint.fillStyle = rule.color;
      paint.fillRect(rule.x, rule.y, rule.w, rule.h);
    }
  }

  _buildRouteLayer() {
    const { width, height } = this,
      idPrefix = this._svgIdPrefix;
    const westBankPathData =
      'M' +
      this.westBankPolygon.map((point) => round1(point[0]) + ' ' + round1(point[1])).join('L') +
      'Z';
    const districtPolygons = this.districts
      .map(
        (district, i) =>
          `<polygon class="map-fold__district-highlight" data-i="${i}" style="fill:var(--district-${district.paletteIndex + 1})" points="${district.points.map((point) => round1(point[0]) + ',' + round1(point[1])).join(' ')}"/>`,
      )
      .join('');
    this.routeLayer.setAttribute('width', width);
    this.routeLayer.setAttribute('height', height);
    this.routeLayer.setAttribute('viewBox', `0 0 ${width} ${height}`);
    // Штрих маски белый намеренно: в SVG-маске это «полностью видно», а не цвет.
    this.routeLayer.innerHTML = `<defs><clipPath id="${idPrefix}-west"><path d="${westBankPathData}"/></clipPath><mask id="${idPrefix}-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}"><path class="map-fold__mask" fill="none" stroke="#fff" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/></mask></defs>
<g class="map-fold__highlights" clip-path="url(#${idPrefix}-west)">${districtPolygons}</g>
<g class="map-fold__route" mask="url(#${idPrefix}-mask)"><path class="map-fold__route-casing"/><path class="map-fold__route-dash"/></g>
<g class="map-fold__destination"><circle class="map-fold__destination-ring" r="7"/><circle class="map-fold__destination-dot" r="2.5"/></g>
<g class="map-fold__rings"><ellipse class="map-fold__ring" rx="100" ry="30" vector-effect="non-scaling-stroke"/><ellipse class="map-fold__ring" rx="100" ry="30" vector-effect="non-scaling-stroke"/></g>
<g class="map-fold__pin"><ellipse class="map-fold__pin-shadow" rx="9" ry="3"/><g class="map-fold__pin-body"><path class="map-fold__pin-head" d="M0 0C-3 -8 -13 -15 -13 -26A13 13 0 1 1 13 -26C13 -15 3 -8 0 0Z"/><circle class="map-fold__pin-eye" cx="0" cy="-26" r="5"/></g></g>`;
    const find = (selector) => this.routeLayer.querySelector(selector);
    this.parts = {
      highlights: find('.map-fold__highlights'),
      route: find('.map-fold__route'),
      mask: find('.map-fold__mask'),
      routeCasing: find('.map-fold__route-casing'),
      routeDash: find('.map-fold__route-dash'),
      dest: find('.map-fold__destination'),
      ringsGroup: find('.map-fold__rings'),
      rings: [...this.routeLayer.querySelectorAll('.map-fold__ring')],
      pin: find('.map-fold__pin'),
      pinBody: find('.map-fold__pin-body'),
      pinShadow: find('.map-fold__pin-shadow'),
    };
    this.routeLayer.querySelectorAll('.map-fold__district-highlight').forEach((polygon) => {
      this.districts[+polygon.dataset.i].el = polygon;
    });
    this.labelEl.style.setProperty('--map-fold-label-size', this.mobile ? '17px' : '24px');
    this._resetRouteLayer();
  }

  _resetRouteLayer() {
    const gsap = this.gsap,
      parts = this.parts;
    if (!parts) return;
    parts.highlights.style.visibility =
      parts.route.style.visibility =
      parts.dest.style.visibility =
      this.labelEl.style.visibility =
      this.originEl.style.visibility =
        '';
    gsap.set(
      this.districts.map((district) => district.el),
      { opacity: 0 },
    );
    // Полностью сбрасываем прошлый маршрут: пунктир маски повторяется каждые 2·L, и одного большого
    // смещения пунктира хватило бы, чтобы в начале следующего перехода проступили куски старого
    // маршрута.
    [parts.routeCasing, parts.routeDash, parts.mask].forEach((path) => path.removeAttribute('d'));
    parts.mask.removeAttribute('stroke-dasharray');
    gsap.set(parts.mask, { strokeDashoffset: 0 });
    gsap.set(parts.rings, { opacity: 0 });
    gsap.set(parts.pinBody, { y: -2000, opacity: 1, scaleX: 1, scaleY: 1, svgOrigin: '0 0' });
    gsap.set(parts.pinShadow, { opacity: 0, scale: 0.25, svgOrigin: '0 0' });
    gsap.set(parts.dest, { opacity: 0 });
    gsap.set([this.routeLayer, this.labelEl, this.originEl], { opacity: 1 });
    this._route = null;
  }

  _prepareRoute(label, from) {
    const { width, height } = this,
      gsap = this.gsap;
    // подпись пункта назначения
    const labelElement = this.labelEl;
    labelElement.textContent = '';
    const originElement = this.originEl;
    originElement.textContent = '';
    const caption = createElement('div', 'map-fold__label-caption', labelElement),
      name = createElement('div', 'map-fold__label-name', labelElement);
    this.ruleEl = createElement('div', 'map-fold__label-rule', labelElement);
    const chars = (text, className, parent) =>
      [...text.toUpperCase()].map((character) => {
        const span = createElement('span', className, parent);
        span.textContent = character === ' ' ? '\u00A0' : character;
        return span;
      });
    this._captionChars = chars(this.opts.caption, 'map-fold__caption-char', caption);
    this._nameChars = chars(label || ' ', 'map-fold__name-char', name);
    const originChars = from
      ? chars(
          from,
          'map-fold__origin-char',
          createElement('div', 'map-fold__label-caption', originElement),
        )
      : [];
    this._originChars = originChars;
    this._labelChars = [...this._captionChars, ...this._nameChars, ...originChars];
    const labelWidth = labelElement.offsetWidth,
      labelHeight = labelElement.offsetHeight;
    // старт и пункт назначения
    this._origin = this.gridPoint(0, 0);
    const originWidth = originElement.offsetWidth,
      ox =
        this._origin[0] + 14 + originWidth > width - 12
          ? this._origin[0] - 14 - originWidth
          : this._origin[0] + 14;
    originElement.style.left = ox + 'px';
    originElement.style.top = this._origin[1] + 8 + 'px';
    this._originBox = { x: ox - 6, y: this._origin[1] - 40, w: originWidth + 12, h: 60 };
    const compass = this.compass,
      overlaps = (first, second) =>
        first.x < second.x + second.w &&
        first.x + first.w > second.x &&
        first.y < second.y + second.h &&
        first.y + first.h > second.y;
    let dest = null;
    for (let k = 0; k < 120 && !dest; k++) {
      const angle = Math.random() * TAU,
        distance = Math.hypot(width, height) * (0.15 + Math.random() * 0.14);
      const [gridColumn, gridRow] = this.toGrid(
          width / 2 + Math.cos(angle) * distance,
          height / 2 + Math.sin(angle) * distance,
        ),
        i = Math.round(gridColumn),
        j = Math.round(gridRow);
      if (Math.abs(i) < 2 || Math.abs(j) < 2) continue;
      const [x, y] = this.gridPoint(i, j);
      if (!this.isWestOfRiver(x, y, 24) || x < 20) continue;
      const right = x + 18 + labelWidth <= width - 16,
        left = x - 18 - labelWidth >= 16;
      if (!right && !left) continue;
      const box = {
        x: right ? x + 18 : x - 18 - labelWidth,
        y: y - labelHeight / 2,
        w: labelWidth,
        h: labelHeight,
      };
      if (box.y < 24 || box.y + labelHeight > height - 24) continue;
      if (
        overlaps(box, this._originBox) ||
        overlaps(box, {
          x: compass.x - compass.radius - 14,
          y: compass.y - compass.radius - 24,
          w: compass.radius * 2 + 28,
          h: compass.radius * 2 + 40,
        })
      )
        continue;
      dest = { i, j, x, y, box };
    }
    if (!dest) {
      const i = 3,
        j = -2,
        [x, y] = this.gridPoint(i, j);
      dest = {
        i,
        j,
        x,
        y,
        box: {
          x: clamp(x + 18, 16, width - labelWidth - 16),
          y: clamp(y - labelHeight / 2, 24, height - labelHeight - 24),
        },
      };
    }
    this._destination = dest;
    this._routeSignature = '';
    labelElement.style.left = dest.box.x + 'px';
    labelElement.style.top = dest.box.y + 'px';
    const parts = this.parts;
    parts.pin.setAttribute(
      'transform',
      `translate(${round1(this._origin[0])} ${round1(this._origin[1])})`,
    );
    parts.ringsGroup.setAttribute(
      'transform',
      `translate(${round1(this._origin[0])} ${round1(this._origin[1])})`,
    );
    parts.dest.querySelectorAll('circle').forEach((circle) => {
      circle.setAttribute('cx', round1(dest.x));
      circle.setAttribute('cy', round1(dest.y));
    });
    gsap.set(parts.dest, { opacity: 0 });
    gsap.set(parts.rings, { svgOrigin: '0 0' });
    gsap.set([...this._captionChars, ...originChars], { opacity: 0 });
    gsap.set(this._nameChars, { opacity: 0, y: -6, scale: 1.25, transformOrigin: '50% 70%' });
    gsap.set(this.ruleEl, { scaleX: 0 });
  }

  _newRoute() {
    const destination = this._destination;
    let points,
      signature,
      tries = 0;
    do {
      points = this._manhattanPath(destination, true);
      signature = points.map((point) => point.join(',')).join(';');
    } while (signature === this._routeSignature && ++tries < 12);
    this._routeSignature = signature;
    const screenPoints = points.map(([i, j]) => this.gridPoint(i, j)),
      distances = [0];
    for (let k = 1; k < screenPoints.length; k++)
      distances.push(
        distances[k - 1] +
          Math.hypot(
            screenPoints[k][0] - screenPoints[k - 1][0],
            screenPoints[k][1] - screenPoints[k - 1][1],
          ),
      );
    const length = distances[distances.length - 1] + 2,
      d = 'M' + screenPoints.map((point) => round1(point[0]) + ' ' + round1(point[1])).join('L');
    const steps = [];
    screenPoints.forEach((point, k) => {
      if (!this.isWestOfRiver(point[0], point[1])) return;
      let nearest = 0,
        nearestDistance = Infinity;
      this.districtSeeds.forEach((seed, index) => {
        const distance = (seed[0] - point[0]) ** 2 + (seed[1] - point[1]) ** 2;
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = index;
        }
      });
      if (!steps.some((step) => step.district === nearest))
        steps.push({ district: nearest, fraction: distances[k] / length });
    });
    const parts = this.parts;
    [parts.routeCasing, parts.routeDash, parts.mask].forEach((path) => path.setAttribute('d', d));
    parts.mask.setAttribute('stroke-dasharray', `${length} ${length}`);
    this.gsap.set(parts.mask, { strokeDashoffset: length });
    return (this._route = { d, length, steps });
  }

  _startRoute() {
    const gsap = this.gsap,
      parts = this.parts,
      timeline = this._timeline(),
      dropDuration = 0.62,
      impact = dropDuration / 2.75;
    gsap.set(parts.pinBody, { y: -(this._origin[1] + 80), opacity: 1 });
    timeline
      .to(parts.pinBody, { y: 0, duration: dropDuration, ease: 'bounce.out' }, 0)
      .to(
        parts.pinShadow,
        { scale: 1, opacity: 0.45, duration: dropDuration, ease: 'bounce.out' },
        0,
      )
      .fromTo(
        parts.pinBody,
        { scaleX: 1.1, scaleY: 0.84 },
        { scaleX: 1, scaleY: 1, duration: 0.34, ease: 'back.out(3)', immediateRender: false },
        impact,
      )
      .fromTo(
        parts.rings[0],
        { scale: 0.06, opacity: 0.7 },
        { scale: 1.35, opacity: 0, duration: 1, ease: 'power2.out' },
        impact,
      )
      .fromTo(
        parts.rings[1],
        { scale: 0.06, opacity: 0.45 },
        { scale: 0.9, opacity: 0, duration: 0.9, ease: 'power2.out' },
        impact + 0.12,
      )
      .to(parts.dest, { opacity: 1, duration: 0.3, ease: 'power2.out' }, 0.32)
      .to(this._captionChars, { opacity: 1, duration: 0.25, stagger: 0.012, ease: 'none' }, 0.3)
      .to(
        this._originChars,
        { opacity: 1, duration: 0.2, stagger: 0.01, ease: 'none' },
        impact + 0.05,
      )
      .to(
        this._nameChars,
        { opacity: 1, y: 0, scale: 1, duration: 0.3, stagger: 0.035, ease: 'back.out(2)' },
        0.4,
      )
      .to(this.ruleEl, { scaleX: 1, duration: 0.5, ease: 'power3.inOut' }, 0.45)
      .call(() => this._cycleRoute(true), null, 0.2);
    this._routeIntro = timeline;
  }

  _manhattanPath(destination, endVertical) {
    const points = [[0, 0]];
    let i = 0,
      j = 0,
      columnsLeft = Math.abs(destination.i),
      rowsLeft = Math.abs(destination.j);
    const columnStep = Math.sign(destination.i),
      rowStep = Math.sign(destination.j);
    const tail = endVertical ? Math.min(rowsLeft, 1 + Math.floor(Math.random() * 2)) : 0;
    rowsLeft -= tail;
    let axis = Math.random() < 0.5;
    while (columnsLeft || rowsLeft) {
      if (!columnsLeft) axis = false;
      else if (!rowsLeft) axis = true;
      const run = Math.min(axis ? columnsLeft : rowsLeft, 1 + Math.floor(Math.random() * 3));
      for (let k = 0; k < run; k++) {
        if (axis) {
          i += columnStep;
          columnsLeft--;
        } else {
          j += rowStep;
          rowsLeft--;
        }
        points.push([i, j]);
      }
      axis = !axis;
    }
    for (let k = 0; k < tail; k++) {
      j += rowStep;
      points.push([i, j]);
    }
    return points;
  }

  _cycleRoute(first) {
    if (this._state !== 'covered') return;
    // первый маршрут рисуется целиком за минимальные 0.7 с фазы
    const gsap = this.gsap,
      parts = this.parts,
      route = this._newRoute(),
      drawDuration = first ? 0.55 : clamp(route.length / 560, 0.85, 1.5),
      holdDuration = first ? 1.1 : 0.75,
      eraseDuration = 0.65;
    const inverseEase = (ease, fraction) => {
      let low = 0,
        high = 1;
      for (let k = 0; k < 18; k++) {
        const middle = (low + high) / 2;
        ease(middle) < fraction ? (low = middle) : (high = middle);
      }
      return (low + high) / 2;
    };
    const easeInOut = gsap.parseEase('power2.inOut'),
      easeIn = gsap.parseEase('power2.in');
    const timeline = this._timeline({ onComplete: () => this._cycleRoute() });
    timeline.to(
      parts.mask,
      { strokeDashoffset: 0, duration: drawDuration, ease: 'power2.inOut' },
      0,
    );
    route.steps.forEach((step) =>
      timeline.to(
        this.districts[step.district].el,
        { opacity: 0.24, duration: 0.5, ease: 'power2.out', overwrite: 'auto' },
        drawDuration * inverseEase(easeInOut, step.fraction),
      ),
    );
    timeline.to(
      parts.mask,
      { strokeDashoffset: -route.length, duration: eraseDuration, ease: 'power2.in' },
      drawDuration + holdDuration,
    );
    route.steps.forEach((step) =>
      timeline.to(
        this.districts[step.district].el,
        { opacity: 0, duration: 0.45, ease: 'power1.inOut', overwrite: 'auto' },
        drawDuration + holdDuration + eraseDuration * inverseEase(easeIn, step.fraction),
      ),
    );
    timeline.to({}, { duration: 0.15 });
    this._routeLoop = timeline;
  }

  _captureLabel() {
    const measure =
        this._measureContext ||
        (this._measureContext = document.createElement('canvas').getContext('2d')),
      metrics = new Map(),
      glyphs = [];
    for (const span of this._labelChars) {
      const character = span.textContent;
      if (!character.trim()) continue;
      const style = getComputedStyle(span),
        font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      let fontMetrics = metrics.get(font);
      if (!fontMetrics) {
        measure.font = font;
        const t = measure.measureText('НЙg'),
          fontSize = parseFloat(style.fontSize);
        fontMetrics = {
          A: t.fontBoundingBoxAscent ?? fontSize * 0.8,
          D: t.fontBoundingBoxDescent ?? fontSize * 0.2,
        };
        metrics.set(font, fontMetrics);
      }
      const rect = span.getBoundingClientRect();
      glyphs.push({
        character,
        font,
        color: style.color,
        x: rect.left,
        y: rect.top + (rect.height - (fontMetrics.A + fontMetrics.D)) / 2 + fontMetrics.A,
      });
    }
    const ruleRect = this.ruleEl.getBoundingClientRect();
    this._glyphs = glyphs;
    this._rule = {
      x: ruleRect.left,
      y: ruleRect.top,
      w: ruleRect.width,
      h: ruleRect.height,
      color: getComputedStyle(this.ruleEl).backgroundColor,
    };
  }

  _render() {
    const { columnCount, rowCount, cellWidth, cellHeight, flight } = this;
    let kx = 1,
      ky = 1;
    const columnAngles = [0],
      rowAngles = [0];
    for (let i = 1; i < columnCount; i++) {
      const angle = this.columnHinges[i].angle;
      kx += (1 + Math.cos(angle * DEG_TO_RAD)) / 2;
      columnAngles[i] = columnAngles[i - 1] + angle;
      this.columnElements[i].style.transform = `rotateY(${angle.toFixed(2)}deg)`;
    }
    for (let j = 1; j < rowCount; j++) {
      const angle = this.rowHinges[j].angle;
      ky += (1 + Math.cos(angle * DEG_TO_RAD)) / 2;
      rowAngles[j] = rowAngles[j - 1] + angle;
      const t = `rotateX(${angle.toFixed(2)}deg)`;
      for (let i = 0; i < columnCount; i++) this.rowElements[i][j].style.transform = t;
    }
    this.sheet.style.transform = `translate3d(${((-kx * cellWidth) / 2).toFixed(2)}px,${((-ky * cellHeight) / 2).toFixed(2)}px,0)`;
    this.flyer.style.transform = `translate3d(${flight.x.toFixed(2)}px,${flight.y.toFixed(2)}px,0) rotateX(${flight.rotateX.toFixed(2)}deg) rotateY(${flight.rotateY.toFixed(2)}deg) rotateZ(${flight.rotateZ.toFixed(2)}deg) scale3d(${flight.scale},${flight.scale},${flight.scale})`;
    this.shadowEl.style.opacity = flight.shadow.toFixed(3);
    for (const face of this.faces) {
      const sinColumn = Math.sin(columnAngles[face.i] * DEG_TO_RAD),
        sinRow = Math.sin(rowAngles[face.j] * DEG_TO_RAD);
      const shadeXOpacity = sinColumn > 0 ? 0.75 * sinColumn : 0.18 * -sinColumn,
        shadeYOpacity = sinRow < 0 ? 0.75 * -sinRow : 0.18 * sinRow,
        lightOpacity = Math.min(1, Math.max(0, -sinColumn) + Math.max(0, sinRow)),
        backOpacity = Math.min(
          0.85,
          0.15 + 0.6 * Math.max(0, -sinColumn) + 0.6 * Math.max(0, sinRow),
        );
      const key = `${shadeXOpacity.toFixed(3)}|${shadeYOpacity.toFixed(3)}|${lightOpacity.toFixed(3)}|${backOpacity.toFixed(3)}`;
      if (key === face.key) continue;
      face.key = key;
      face.shadeX.style.opacity = shadeXOpacity.toFixed(3);
      face.shadeY.style.opacity = shadeYOpacity.toFixed(3);
      face.shadeLight.style.opacity = lightOpacity.toFixed(3);
      face.shadeBack.style.opacity = backOpacity.toFixed(3);
    }
  }
}
