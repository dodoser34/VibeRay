// Флаги удобства одного посетителя (например, «подсказки уже показаны»). Хранилище может быть
// недоступно (приватный режим, запрет сайта) — тогда флаг просто не запоминается.
export function readFlag(key) {
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function writeFlag(key) {
  try {
    window.localStorage.setItem(key, '1');
  } catch {
    // Нет хранилища — в следующий раз подсказки покажутся снова, это не страшно.
  }
}
