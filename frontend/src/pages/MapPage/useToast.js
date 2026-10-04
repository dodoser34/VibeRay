import { useEffect, useState } from 'react';

// Короткое сообщение внизу карты («настроение отмечено»), само исчезает через durationMs.
export function useToast(durationMs) {
  const [toast, setToast] = useState(null);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), durationMs);
    return () => clearTimeout(timer);
  }, [toast, durationMs]);
  return [toast, setToast];
}
