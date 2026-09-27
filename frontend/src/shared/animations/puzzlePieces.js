const SVG_NS = 'http://www.w3.org/2000/svg';

// Один край пазла от A до B (без начального M). `tab`: +1 / −1 — выступ слева / справа от
// направления движения, 0 — прямой (внешний) край.
function edge([ax, ay], [bx, by], tab) {
  if (!tab) return `L${bx} ${by}`;
  const dx = bx - ax;
  const dy = by - ay;
  const length = Math.hypot(dx, dy);
  const h = tab * length * 0.24;
  const nx = -dy / length;
  const ny = dx / length;
  const p = (along, out) =>
    `${(ax + dx * along + nx * h * out).toFixed(2)} ${(ay + dy * along + ny * h * out).toFixed(2)}`;
  return [
    `L${p(0.36, 0)}`,
    `C${p(0.42, 0.05)} ${p(0.3, 1)} ${p(0.5, 1)}`,
    `C${p(0.7, 1)} ${p(0.58, 0.05)} ${p(0.64, 0)}`,
    `L${bx} ${by}`,
  ].join('');
}

// Накрывает `container` SVG-пазлом, кусочки которого вместе образуют скруглённый прямоугольник его
// размера. Возвращает элементы кусочков (для анимации) и `destroy()`.
export function createPuzzle(container, { cols = 4, rows = 5, radius = 32, className = '' } = {}) {
  const width = container.offsetWidth;
  const height = container.offsetHeight;
  const cw = width / cols;
  const rh = height / rows;
  const random = () => (Math.random() < 0.5 ? -1 : 1);
  // Общие внутренние края: выступ одного кусочка — это паз соседнего.
  const vertical = Array.from({ length: rows }, () => Array.from({ length: cols - 1 }, random));
  const horizontal = Array.from({ length: rows - 1 }, () => Array.from({ length: cols }, random));

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', className);
  Object.assign(svg.style, { position: 'absolute', inset: '0', overflow: 'visible' });

  const clipId = `puzzle-${Math.random().toString(36).slice(2)}`;
  const defs = document.createElementNS(SVG_NS, 'defs');
  const clip = document.createElementNS(SVG_NS, 'clipPath');
  clip.setAttribute('id', clipId);
  const rect = document.createElementNS(SVG_NS, 'rect');
  Object.entries({ width, height, rx: radius }).forEach(([k, v]) => rect.setAttribute(k, v));
  clip.append(rect);
  defs.append(clip);
  svg.append(defs);

  const pieces = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = c * cw;
      const y0 = r * rh;
      const tl = [x0, y0];
      const tr = [x0 + cw, y0];
      const br = [x0 + cw, y0 + rh];
      const bl = [x0, y0 + rh];
      const top = r > 0 ? -horizontal[r - 1][c] : 0;
      const right = c < cols - 1 ? vertical[r][c] : 0;
      const bottom = r < rows - 1 ? horizontal[r][c] : 0;
      const left = c > 0 ? -vertical[r][c - 1] : 0;
      const d = `M${x0} ${y0}${edge(tl, tr, top)}${edge(tr, br, right)}${edge(br, bl, bottom)}${edge(bl, tl, left)}Z`;
      // Каждый кусочек обрезается скруглённым контуром карточки (внешние углы остаются круглыми).
      const group = document.createElementNS(SVG_NS, 'g');
      group.setAttribute('clip-path', `url(#${clipId})`);
      const piece = document.createElementNS(SVG_NS, 'path');
      piece.setAttribute('d', d);
      group.append(piece);
      const holder = document.createElementNS(SVG_NS, 'g');
      holder.style.transformOrigin = `${x0 + cw / 2}px ${y0 + rh / 2}px`;
      holder.append(group);
      svg.append(holder);
      pieces.push(holder);
    }
  }
  container.append(svg);
  return { svg, pieces, destroy: () => svg.remove() };
}
