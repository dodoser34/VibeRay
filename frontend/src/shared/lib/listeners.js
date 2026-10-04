// Подписчики модульного состояния (тема, язык, режим графики): subscribe подходит для
// useSyncExternalStore и возвращает отписку, notify оповещает всех.
export function createListeners() {
  const listeners = new Set();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    notify() {
      listeners.forEach((listener) => listener());
    },
  };
}
