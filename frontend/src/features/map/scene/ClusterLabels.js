import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { PROBLEM_STATUSES } from '@/shared/config/problemStatuses';

const LEAVE_MS = 260;
const EASE_RATE = 9;

// Кольцо кластера — доли статусов его проблем по кругу, цветами статусов (токены).
function ringOf(byStatus, count) {
  let from = 0;
  const stops = PROBLEM_STATUSES.filter((status) => byStatus[status.code]).map((status) => {
    const to = from + (byStatus[status.code] / count) * 100;
    const stop = `var(${status.colorVar}) ${from.toFixed(1)}% ${to.toFixed(1)}%`;
    from = to;
    return stop;
  });
  return `conic-gradient(${stops.join(', ')})`;
}

// Значки кластеров меток — DOM-кнопки над картой (чёткий текст, фокус с клавиатуры). Каждый
// кластер узнаётся по ключу, поэтому значок не пересоздаётся, а едет за центром и меняет число.
export class ClusterLabels {
  constructor(parent, { className, countClassName, describe, onSelect }) {
    this.parent = parent;
    this.className = className;
    this.countClassName = countClassName;
    this.describe = describe;
    this.onSelect = onSelect;
    this.items = new Map(); // ключ → { object, button, count, target, center }
  }

  sync(clusters, anchorOf) {
    const seen = new Set();
    clusters.forEach((cluster) => {
      seen.add(cluster.key);
      let item = this.items.get(cluster.key);
      if (!item) item = this.create(cluster.key, anchorOf(cluster.center));
      item.center = cluster.center;
      anchorOf(cluster.center, item.target);
      if (item.count !== cluster.count) {
        item.count = cluster.count;
        item.countNode.textContent = String(cluster.count);
        item.button.setAttribute('aria-label', this.describe(cluster.count));
        item.button.style.setProperty(
          '--size',
          `${Math.round(34 + Math.log2(cluster.count) * 6)}px`,
        );
      }
      item.button.style.setProperty('--ring', ringOf(cluster.byStatus, cluster.count));
    });
    this.items.forEach((item, key) => !seen.has(key) && this.remove(key));
  }

  create(key, position) {
    const element = document.createElement('div');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = this.className;
    button.dataset.ui = 'map-cluster';
    const countNode = document.createElement('span');
    countNode.className = this.countClassName;
    button.append(countNode);
    element.append(button);
    const object = new CSS2DObject(element);
    object.position.copy(position);
    this.parent.add(object);
    const item = { object, button, countNode, count: 0, target: position.clone(), center: null };
    button.addEventListener('click', () => item.center && this.onSelect(item.center));
    this.items.set(key, item);
    return item;
  }

  remove(key) {
    const item = this.items.get(key);
    this.items.delete(key);
    item.button.dataset.leaving = 'true';
    setTimeout(() => {
      item.object.removeFromParent();
      item.object.element.remove();
    }, LEAVE_MS);
  }

  update(delta) {
    const k = 1 - Math.exp(-delta * EASE_RATE);
    this.items.forEach((item) => item.object.position.lerp(item.target, k));
  }

  // Экранные прямоугольники значков (для раздвигания подписей районов).
  boxes() {
    return [...this.items.values()].map((item) => item.button.getBoundingClientRect());
  }

  clear() {
    [...this.items.keys()].forEach((key) => this.remove(key));
  }

  dispose() {
    this.items.forEach((item) => {
      item.object.removeFromParent();
      item.object.element.remove();
    });
    this.items.clear();
  }
}
