// Жесты тачпада ноутбука поверх OrbitControls (сами они понимают только колесо мыши как зум):
//   • два пальца ведут по тачпаду — карта едет за пальцами 1:1 (как в картографических сервисах);
//   • щипок (браузер присылает его как wheel с ctrlKey) — зум к точке под курсором;
//   • Alt / ⌥ + два пальца — поворот и наклон камеры;
//   • поворот двумя пальцами в Safari (gesturechange) — поворот камеры.
// Колесо мыши по-прежнему зумит через OrbitControls. Нажатие (тап) по тачпаду — обычный клик:
// его разбирает ScenePicker.
//
// Слушатель стоит на контейнере карты (canvas + подписи + значки кластеров), в фазе захвата: жест
// над значком кластера тоже двигает карту, и обработчик успевает раньше OrbitControls на canvas.

const PAN_SPEED = 1; // пикселей сдвига карты на пиксель прокрутки
const PINCH_SPEED = 0.01; // доля расстояния на единицу deltaY щипка
const PINCH_MAX_STEP = 25; // Ctrl + колесо шлёт шаги по 100+: без предела зум прыгал бы
const ORBIT_SPEED = 0.004; // радиан на пиксель прокрутки с Alt
const SESSION_MS = 180; // события ближе этого — один жест: тип устройства в нём не меняется
const MOUSE_MIN_DELTA = 50; // шаг колеса мыши почти всегда ≥ 100 px, у тачпада — единицы–десятки
const LINE_PX = 16;
const STATE_NONE = -1; // OrbitControls: никто не тянет камеру мышью или пальцем

// Тачпад или колесо мыши? Однозначного признака у WheelEvent нет — собираем косвенные.
function looksLikeTrackpad(event) {
  if (event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) return false; // строки/страницы — колесо
  if (event.deltaX !== 0) return true; // у обычного колеса горизонтали нет
  // Chrome/Safari на macOS: у тачпада устаревший wheelDeltaY ровно −3 × deltaY.
  if (event.wheelDeltaY && event.wheelDeltaY === -3 * event.deltaY) return true;
  return Math.abs(event.deltaY) < MOUSE_MIN_DELTA;
}

export function attachTrackpadGestures(controls, element) {
  let lastWheelAt = 0;
  let sessionIsTrackpad = false;
  let gestureRotation = 0;

  // Камеру сейчас ведёт кто-то другой: перелёт GSAP (controls выключены) или перетаскивание.
  const busy = () => !controls.enabled || controls.state !== STATE_NONE;

  // Сдвиг и поворот применяются сразу и целиком. Через затухание OrbitControls каждый шаг
  // доезжал бы ещё десяток кадров (суммарно ×12), и карта обгоняла бы пальцы; инерцию после
  // жеста и так даёт сама система.
  const moveNow = (apply) => {
    const damping = controls.enableDamping;
    controls.enableDamping = false;
    controls.dispatchEvent({ type: 'start' });
    apply();
    controls.update();
    controls.dispatchEvent({ type: 'end' });
    controls.enableDamping = damping;
  };

  const zoomAt = (deltaY, clientX, clientY) => {
    // Зум к курсору — только на время щипка: колесо мыши остаётся прежним (к центру).
    controls.zoomToCursor = true;
    controls._updateZoomParameters(clientX, clientY);
    controls._dollyOut(Math.exp(-deltaY * PINCH_SPEED));
    controls.update(); // пока zoomToCursor ещё включён
    controls.zoomToCursor = false;
  };

  const onWheel = (event) => {
    const now = performance.now();
    if (now - lastWheelAt > SESSION_MS) sessionIsTrackpad = looksLikeTrackpad(event);
    else if (!sessionIsTrackpad && event.deltaX !== 0) sessionIsTrackpad = true;
    lastWheelAt = now;

    const pinch = event.ctrlKey; // щипок на Windows и macOS, а также Ctrl + колесо
    const onCanvas = event.target === controls.domElement;
    // Колесо мыши над canvas зумит сам OrbitControls — пропускаем ему без изменений.
    if (!pinch && !sessionIsTrackpad && onCanvas) return;

    // Всё остальное над картой — наше: браузер не должен ни масштабировать страницу (щипок),
    // ни листать историю (горизонтальный свайп), даже пока камера в перелёте.
    event.preventDefault();
    event.stopImmediatePropagation();
    if (busy()) return;

    const scale = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? LINE_PX : 1;
    const dx = event.deltaX * scale;
    const dy = event.deltaY * scale;

    if (pinch) {
      if (!controls.enableZoom) return;
      const step = Math.max(-PINCH_MAX_STEP, Math.min(PINCH_MAX_STEP, dy));
      moveNow(() => zoomAt(step, event.clientX, event.clientY));
    } else if (!sessionIsTrackpad) {
      // Колесо мыши над значком кластера или подписью — тот же зум, что над самой картой.
      if (controls.enableZoom) moveNow(() => controls._handleMouseWheel(controls._customWheelEvent(event)));
    } else if (event.altKey) {
      if (controls.enableRotate) {
        moveNow(() => {
          controls._rotateLeft(dx * ORBIT_SPEED);
          controls._rotateUp(dy * ORBIT_SPEED);
        });
      }
    } else if (controls.enablePan) {
      moveNow(() => controls._pan(-dx * PAN_SPEED, -dy * PAN_SPEED));
    }
  };

  // Safari на macOS: собственные события жестов. Масштаб уже пришёл щипком через wheel+ctrlKey,
  // отсюда берём только вращение; preventDefault не даёт браузеру масштабировать всю страницу.
  const onGestureStart = (event) => {
    event.preventDefault();
    gestureRotation = event.rotation ?? 0;
  };
  const onGestureChange = (event) => {
    event.preventDefault();
    const rotation = event.rotation ?? 0;
    const turn = ((rotation - gestureRotation) * Math.PI) / 180;
    gestureRotation = rotation;
    if (!busy() && controls.enableRotate && turn) moveNow(() => controls._rotateLeft(turn));
  };
  const onGestureEnd = (event) => event.preventDefault();

  element.addEventListener('wheel', onWheel, { passive: false, capture: true });
  element.addEventListener('gesturestart', onGestureStart);
  element.addEventListener('gesturechange', onGestureChange);
  element.addEventListener('gestureend', onGestureEnd);

  return () => {
    element.removeEventListener('wheel', onWheel, { capture: true });
    element.removeEventListener('gesturestart', onGestureStart);
    element.removeEventListener('gesturechange', onGestureChange);
    element.removeEventListener('gestureend', onGestureEnd);
  };
}
