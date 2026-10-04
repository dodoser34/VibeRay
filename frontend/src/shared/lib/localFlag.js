// Флаги и значения удобства одного посетителя («подсказки уже показаны», «панель скрыта», множитель
// высоты районов, выбранные тема, язык и графика). Хранилище может быть недоступно (приватный режим,
// запрет сайта) — тогда значение просто не запоминается и действует до перезагрузки.
export function readFlag(key) {
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function writeFlag(key, on = true) {
  try {
    if (on) window.localStorage.setItem(key, '1');
    else window.localStorage.removeItem(key);
  } catch {
    // Нет хранилища — флаг не запомнится, это не страшно.
  }
}

// Число из хранилища; если его нет или оно испорчено — fallback.
export function readNumber(key, fallback) {
  try {
    const value = Number(window.localStorage.getItem(key));
    return window.localStorage.getItem(key) !== null && Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function writeNumber(key, value) {
  writeValue(key, value);
}

// Сохранённый выбор из списка допустимых (тема, язык, режим графики); null — нет, испорчен или
// хранилище недоступно.
export function readChoice(key, allowed) {
  try {
    const value = window.localStorage.getItem(key);
    return allowed.includes(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeValue(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Нет хранилища — значение действует до перезагрузки.
  }
}
