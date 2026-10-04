// Режим графики: полная (3D-сцены) или лёгкая (плоские иллюстрации вместо тяжёлых сцен, например
// истории «О проекте»). Пользователь выбирает в настройках «авто», «полная» или «лёгкая»; в «авто»
// лёгкая включается сама на медленной сети, при экономии трафика, на слабом устройстве, без WebGL2
// или если сцена не успела загрузиться (fallBackToLite).
import { createListeners } from '@/shared/lib/listeners';
import { readChoice, writeValue } from '@/shared/lib/localFlag';

export const GRAPHICS_MODES = ['auto', 'full', 'lite'];
const STORAGE_KEY = 'viberay.graphics';
const SLOW_NETWORKS = ['slow-2g', '2g', '3g'];

const listeners = createListeners();
let fellBack = false;
let mode = readChoice(STORAGE_KEY, GRAPHICS_MODES) ?? 'auto';

let webgl2 = null;
function supportsWebGL2() {
  if (webgl2 === null) {
    const gl = document.createElement('canvas').getContext('webgl2');
    webgl2 = Boolean(gl);
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  }
  return webgl2;
}

// Слабое окружение: экономия трафика или медленная сеть, мало памяти или ядер, нет WebGL2.
function weakEnvironment() {
  const connection = navigator.connection;
  if (connection?.saveData || SLOW_NETWORKS.includes(connection?.effectiveType)) return true;
  if ((navigator.deviceMemory ?? 8) <= 2 || (navigator.hardwareConcurrency ?? 8) <= 2) return true;
  return !supportsWebGL2();
}

export function getGraphicsMode() {
  return mode;
}

export function isLiteGraphics() {
  if (mode !== 'auto') return mode === 'lite';
  return fellBack || weakEnvironment();
}

// Хорошая ли сеть для фоновой подгрузки страниц и моделей.
export function canPrefetch() {
  const connection = navigator.connection;
  return !connection?.saveData && !SLOW_NETWORKS.includes(connection?.effectiveType);
}

export const subscribeGraphics = listeners.subscribe;

export function setGraphicsMode(next) {
  mode = next;
  writeValue(STORAGE_KEY, next);
  listeners.notify();
}

// Сцена не загрузилась вовремя или упала: в режиме «авто» до перезагрузки показываем лёгкую графику.
export function fallBackToLite() {
  if (fellBack) return;
  fellBack = true;
  listeners.notify();
}
