// Аудит вёрстки — выполняется внутри страницы (page.evaluate), поэтому функция самодостаточна: никаких
// импортов и замыканий, всё нужное приходит в options. Возвращает список нарушений:
//   error   — page-scroll-x (страница шире окна), clipped (текст обрезан своим overflow),
//             clipped-x / clipped-y (текст вылез за обрезающего предка), offscreen (оверлей за краем
//             окна), overlap (пересеклись оверлеи), small-target (цель на сенсоре меньше 44 px);
//   warning — ellipsis (многоточие или line-clamp вне белого списка).
export function auditLayout({
  ellipsisAllowed,
  overlays,
  floating,
  touch,
  touchExempt,
  sceneObjects,
  minTarget,
}) {
  const issues = [];
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const TOLERANCE = 1;

  const matchesAny = (element, selectors) =>
    selectors.some((selector) => element.closest(selector) !== null);

  // Короткое имя элемента для отчёта: ближайший data-ui и локальное имя класса CSS-модуля.
  const describe = (element) => {
    const area = element.closest('[data-ui]')?.getAttribute('data-ui');
    const tag = element.tagName.toLowerCase();
    const className = [...element.classList]
      .map((name) => name.replace(/^_/, '').replace(/_[\w-]{5}(_\d+)?$/, ''))
      .slice(0, 2)
      .join('.');
    return [area && `[${area}]`, className ? `${tag}.${className}` : tag].filter(Boolean).join(' ');
  };

  const snippet = (element) => element.textContent.replace(/\s+/g, ' ').trim().slice(0, 60);

  // Видим ли элемент глазами: не скрыт, не прозрачен и не «только для экранных читалок» (блок 1×1 px
  // с обрезкой — подпись таблицы, скрытое поле выбора аватара).
  const isShown = (element) => {
    if (element.closest('[aria-hidden="true"], [inert], [hidden]')) return false;
    for (let node = element; node && node !== document.documentElement; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      if (Number(style.opacity) < 0.05) return false;
      if (style.display === 'contents') continue;
      const box = node.getBoundingClientRect();
      if (box.width <= 2 || box.height <= 2) return false;
    }
    return true;
  };

  const ownText = (element) =>
    [...element.childNodes].filter(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0,
    );

  const push = (issue) => issues.push(issue);

  // 1. Страница шире окна
  const pageWidth = document.scrollingElement.scrollWidth;
  if (pageWidth > viewportWidth + TOLERANCE) {
    push({
      severity: 'error',
      type: 'page-scroll-x',
      target: 'document',
      text: '',
      detail: `${pageWidth} > ${viewportWidth}`,
    });
  }

  // Ближайший предок, который обрезает или прокручивает по оси: auto/scroll — текст можно докрутить,
  // это не ошибка; hidden/clip — текст за краем потерян.
  const clipperOf = (element, axis) => {
    const property = axis === 'x' ? 'overflowX' : 'overflowY';
    for (let node = element.parentElement; node; node = node.parentElement) {
      const value = getComputedStyle(node)[property];
      if (value === 'auto' || value === 'scroll') return { node, scrolls: true };
      if (value === 'hidden' || value === 'clip') return { node, scrolls: false };
      if (node === document.body) break;
    }
    return null;
  };

  const isFixedLayer = (element) => {
    for (let node = element; node && node !== document.body; node = node.parentElement) {
      if (getComputedStyle(node).position === 'fixed') return true;
    }
    return false;
  };

  // 2. Текст: обрезан своим overflow, многоточием или вылез за обрезающего предка
  const elements = document.body.querySelectorAll('*');
  for (const element of elements) {
    if (element.closest('svg, script, style, noscript, canvas')) continue;
    if (matchesAny(element, sceneObjects)) continue;
    const textNodes = ownText(element);
    if (!textNodes.length || !isShown(element)) continue;
    const style = getComputedStyle(element);
    const fontSize = parseFloat(style.fontSize) || 16;

    const overflowsX = element.scrollWidth > element.clientWidth + TOLERANCE;
    const overflowsY = element.scrollHeight > element.clientHeight + Math.max(2, fontSize * 0.2);
    const clampsLines = style.webkitLineClamp && style.webkitLineClamp !== 'none';
    const truncates =
      (style.textOverflow === 'ellipsis' && overflowsX) || (clampsLines && overflowsY);
    if (truncates) {
      if (!matchesAny(element, ellipsisAllowed)) {
        push({
          severity: 'warning',
          type: 'ellipsis',
          target: describe(element),
          text: snippet(element),
          detail: clampsLines ? 'line-clamp' : 'text-overflow',
        });
      }
    } else if (
      overflowsX &&
      (style.overflowX === 'hidden' || style.overflowX === 'clip') &&
      element.clientWidth > 0
    ) {
      push({
        severity: 'error',
        type: 'clipped',
        target: describe(element),
        text: snippet(element),
        detail: `scrollWidth ${element.scrollWidth} > ${element.clientWidth}`,
      });
      continue;
    }

    const range = document.createRange();
    const fixed = isFixedLayer(element);
    let reported = false;
    for (const node of textNodes) {
      if (reported) break;
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (rect.width < 1 || rect.height < 1) continue;
        for (const axis of ['x', 'y']) {
          const clipper = clipperOf(element, axis);
          let bounds = null;
          if (clipper && !clipper.scrolls) bounds = clipper.node.getBoundingClientRect();
          else if (!clipper && (axis === 'x' || fixed))
            bounds = { left: 0, top: 0, right: viewportWidth, bottom: viewportHeight };
          if (!bounds) continue;
          // По вертикали строка шире своего текста (межстрочный интервал) — допуск 20 % кегля
          const slack = axis === 'x' ? TOLERANCE : Math.max(2, fontSize * 0.2);
          const start = axis === 'x' ? rect.left - bounds.left : rect.top - bounds.top;
          const end = axis === 'x' ? bounds.right - rect.right : bounds.bottom - rect.bottom;
          // Текст целиком за краем — это спрятанный, а не обрезанный элемент (уехавшая панель)
          const size = axis === 'x' ? rect.width : rect.height;
          if ((start < -slack || end < -slack) && Math.min(start, end) > -size) {
            push({
              severity: 'error',
              type: `clipped-${axis}`,
              target: describe(element),
              text: snippet(element),
              detail: `${Math.round(Math.min(start, end))}px`,
            });
            reported = true;
            break;
          }
        }
        if (reported) break;
      }
    }
  }

  // 3. Оверлеи и плавающие окна за краем окна, 4. пересечения оверлеев (плавающие окна — карточки
  // обучения — перекрывают страницу намеренно)
  const collect = (selectors) =>
    [...document.querySelectorAll(selectors.join(','))]
      .filter(isShown)
      .map((element) => ({ element, rect: element.getBoundingClientRect() }));
  const boxes = collect(overlays);
  for (const { element, rect } of [...boxes, ...collect(floating)]) {
    const outside = Math.min(
      rect.left,
      rect.top,
      viewportWidth - rect.right,
      viewportHeight - rect.bottom,
    );
    const fullyOutside =
      rect.right <= 0 ||
      rect.bottom <= 0 ||
      rect.left >= viewportWidth ||
      rect.top >= viewportHeight;
    if (outside < -TOLERANCE && !fullyOutside) {
      push({
        severity: 'error',
        type: 'offscreen',
        target: describe(element),
        text: snippet(element).slice(0, 30),
        detail: `${Math.round(outside)}px`,
      });
    }
  }
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const first = boxes[i];
      const second = boxes[j];
      if (first.element.contains(second.element) || second.element.contains(first.element))
        continue;
      const width =
        Math.min(first.rect.right, second.rect.right) - Math.max(first.rect.left, second.rect.left);
      const height =
        Math.min(first.rect.bottom, second.rect.bottom) - Math.max(first.rect.top, second.rect.top);
      if (width > 2 && height > 2) {
        push({
          severity: 'error',
          type: 'overlap',
          target: `${describe(first.element)} × ${describe(second.element)}`,
          text: '',
          detail: `${Math.round(width)}×${Math.round(height)}px`,
        });
      }
    }
  }

  // 5. Цели на сенсоре (ссылки внутри абзаца — исключение WCAG)
  if (touch) {
    const targets = document.querySelectorAll(
      'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="tab"], [role="switch"], [role="option"]',
    );
    for (const element of targets) {
      if (!isShown(element) || element.closest('p') || element.disabled) continue;
      if (matchesAny(element, touchExempt)) continue;
      // Значок, который сейчас исчезает (сжимается анимацией), — уже не цель
      if (element.closest('[data-leaving="true"]')) continue;
      // Ещё растёт анимацией появления — размер не окончательный
      if (element.getAnimations().some((animation) => animation.playState === 'running')) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width + TOLERANCE < minTarget || rect.height + TOLERANCE < minTarget) {
        push({
          severity: 'error',
          type: 'small-target',
          target: describe(element),
          text: (element.getAttribute('aria-label') ?? snippet(element)).slice(0, 40),
          detail: `${Math.round(rect.width)}×${Math.round(rect.height)}px`,
        });
      }
    }
  }

  // Одинаковые нарушения (повторяющиеся строки списка) — одной строкой
  const seen = new Set();
  return issues.filter((issue) => {
    const key = `${issue.type}|${issue.target}|${issue.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
