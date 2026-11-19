// Жесты тачпада ноутбука поверх OrbitControls (сами они понимают только колесо мыши как зум):
//   • два пальца ведут по тачпаду — карта едет за пальцами (как в картографических сервисах);
//   • щипок (браузер присылает его как wheel с ctrlKey) — зум к точке под курсором;
//   • Alt / ⌥ + два пальца — поворот и наклон камеры;
//   • поворот двумя пальцами в Safari (gesturechange) — поворот камеры.
// Колесо мыши проходит дальше в OrbitControls без изменений.

const PAN_SPEED = 1; // пикселей сдвига карты на пиксель прокрутки
const PINCH_SPEED = 0.01; // доля расстояния на единицу deltaY щипка
const ORBIT_SPEED = 0.004; // радиан на пиксель прокрутки с Alt
const SESSION_MS = 180; // события ближе этого — один жест: тип устройства в нём не меняется
const MOUSE_MIN_DELTA = 50; // шаг колеса мыши почти всегда ≥ 100 px, у тачпада — единицы–десятки
const LINE_PX = 16;

// Тачпад или колесо мыши? Однозначного признака у WheelEvent нет — собираем косвенные.
function looksLikeTrackpad(event) {
  if (event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) return false; // строки/страницы — колесо
  if (event.deltaX !== 0) return true; // у обычного колеса горизонтали нет
  // Chrome/Safari на macOS: у тачпада устаревший wheelDeltaY ровно −3 × deltaY.
  if (event.wheelDeltaY && event.wheelDeltaY === -3 * event.deltaY) return true;
  return Math.abs(event.deltaY) < MOUSE_MIN_DELTA;
}

export function attachTrackpadGestures(controls, domElement) {
  let lastWheelAt = 0;
  let sessionIsTrackpad = false;
  let gestureRotation = 0;

  const begin = () => controls.dispatchEvent({ type: 'start' });
  const end = () => controls.dispatchEvent({ type: 'end' });

  const zoomAt = (deltaY, clientX, clientY) => {
    // Зум к курсору включаем только на время щипка: колесо мыши остаётся прежним (к центру).
    controls.zoomToCursor = true;
    controls._updateZoomParameters(clientX, clientY);
    controls.dollyOut(Math.exp(-deltaY * PINCH_SPEED));
    controls.zoomToCursor = false;
  };

  const onWheel = (event) => {
    if (!controls.enabled || controls.state !== -1) return; // перелёт камеры или идёт перетаскивание

    const now = performance.now();
    if (now - lastWheelAt > SESSION_MS) sessionIsTrackpad = looksLikeTrackpad(event);
    else if (!sessionIsTrackpad && event.deltaX !== 0) sessionIsTrackpad = true;
    lastWheelAt = now;

    const scale = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? LINE_PX : 1;
    const dx = event.deltaX * scale;
    const dy = event.deltaY * scale;

    if (event.ctrlKey) {
      // Щипок (на Windows и macOS) или Ctrl + колесо — в обоих случаях зум.
      if (!controls.enableZoom) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      begin();
      // Щипок шлёт мелкие дельты, Ctrl + колесо — крупные шаги: ограничиваем, чтобы не прыгало.
      zoomAt(Math.max(-25, Math.min(25, dy)), event.clientX, event.clientY);
      end();
      return;
    }

    if (!sessionIsTrackpad) return; // колесо мыши — обычный зум OrbitControls

    event.preventDefault();
    event.stopImmediatePropagation();
    begin();
    if (event.altKey) {
      if (controls.enableRotate) {
        controls.rotateLeft(dx * ORBIT_SPEED);
        controls.rotateUp(dy * ORBIT_SPEED);
      }
    } else if (controls.enablePan) {
      controls.pan(-dx * PAN_SPEED, -dy * PAN_SPEED);
    }
    end();
  };

  // Safari на macOS: собственные события жестов. Масштаб уже пришёл щипком через wheel+ctrlKey,
  // отсюда берём только вращение; preventDefault не даёт браузеру масштабировать всю страницу.
  const onGestureStart = (event) => {
    event.preventDefault();
    gestureRotation = event.rotation ?? 0;
    if (controls.enabled) begin();
  };
  const onGestureChange = (event) => {
    event.preventDefault();
    const rotation = event.rotation ?? 0;
    if (controls.enabled && controls.enableRotate) {
      controls.rotateLeft(((rotation - gestureRotation) * Math.PI) / 180);
    }
    gestureRotation = rotation;
  };
  const onGestureEnd = (event) => {
    event.preventDefault();
    if (controls.enabled) end();
  };

  // capture: обработчик срабатывает раньше слушателя wheel самих OrbitControls на том же элементе.
  domElement.addEventListener('wheel', onWheel, { passive: false, capture: true });
  domElement.addEventListener('gesturestart', onGestureStart);
  domElement.addEventListener('gesturechange', onGestureChange);
  domElement.addEventListener('gestureend', onGestureEnd);

  return () => {
    domElement.removeEventListener('wheel', onWheel, { capture: true });
    domElement.removeEventListener('gesturestart', onGestureStart);
    domElement.removeEventListener('gesturechange', onGestureChange);
    domElement.removeEventListener('gestureend', onGestureEnd);
  };
}
