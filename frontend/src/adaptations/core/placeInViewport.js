// Размещение плавающего элемента (подсказка, поповер, карточка обучения, облачко) так, чтобы он
// целиком оставался в окне: выбирается первая сторона из `prefer`, где элемент помещается, иначе —
// та, где не хватает меньше всего; затем позиция прижимается к краям окна. Координаты — клиентские
// (как у getBoundingClientRect и position: fixed).

// Видимая часть окна (при щипковом зуме на телефоне — то, что на экране) с отступом от краёв.
export function viewportBounds(margin = 0) {
  const view = window.visualViewport;
  const left = view?.offsetLeft ?? 0;
  const top = view?.offsetTop ?? 0;
  const width = view?.width ?? window.innerWidth;
  const height = view?.height ?? window.innerHeight;
  return {
    left: left + margin,
    top: top + margin,
    right: left + width - margin,
    bottom: top + height - margin,
    width: width - margin * 2,
    height: height - margin * 2,
  };
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));

// anchor — прямоугольник, к которому крепится элемент ({ left, top, right, bottom }; точка указателя —
// прямоугольник нулевого размера), size — { width, height } элемента, gap — зазор до якоря.
// align: 'start' — от начала якоря, 'center' — по его середине.
// Возвращает { x, y, side, fits }: fits = false, если элемент больше окна, — вызывающий ограничивает
// его max-width / max-height (и прокрутку внутри), а не даёт ему вылезти.
export function placeInViewport({
  anchor,
  size,
  gap = 0,
  prefer = ['below', 'above', 'right', 'left'],
  align = 'start',
  bounds = viewportBounds(),
}) {
  const space = {
    below: bounds.bottom - anchor.bottom - gap,
    above: anchor.top - bounds.top - gap,
    right: bounds.right - anchor.right - gap,
    left: anchor.left - bounds.left - gap,
  };
  const need = { below: size.height, above: size.height, right: size.width, left: size.width };
  const side =
    prefer.find((candidate) => space[candidate] >= need[candidate]) ??
    prefer.reduce((best, candidate) =>
      space[candidate] - need[candidate] > space[best] - need[best] ? candidate : best,
    );

  let x;
  let y;
  if (side === 'below' || side === 'above') {
    y = side === 'below' ? anchor.bottom + gap : anchor.top - gap - size.height;
    x = align === 'center' ? (anchor.left + anchor.right - size.width) / 2 : anchor.left;
  } else {
    x = side === 'right' ? anchor.right + gap : anchor.left - gap - size.width;
    y = align === 'center' ? (anchor.top + anchor.bottom - size.height) / 2 : anchor.top;
  }
  return {
    x: clamp(x, bounds.left, bounds.right - size.width),
    y: clamp(y, bounds.top, bounds.bottom - size.height),
    side,
    fits: size.width <= bounds.width && size.height <= bounds.height,
  };
}
