// «Шлагбаум» для анимаций появления страниц. Пока экран закрыт переходом, новая страница уже
// смонтирована, но её появление должно подождать: шлагбаум открывается, когда переход начинает
// открывать страницу, поэтому появление играет на виду, а не под покрытием. При прямой загрузке
// всегда открыт.
let held = false;
const listeners = new Set();

export function holdPageEntrance() {
  held = true;
  listeners.forEach((listener) => listener());
}

export function releasePageEntrance() {
  if (!held) return;
  held = false;
  listeners.forEach((listener) => listener());
}

export function isPageEntered() {
  return !held;
}

export function subscribePageEntrance(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
