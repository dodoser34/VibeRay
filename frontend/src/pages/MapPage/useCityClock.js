import { useEffect, useState } from 'react';
import { cityClock, parseClock } from '@/shared/lib/cityTime';

const TICK_MS = 60_000;

// Часы города: свет на карте и подпись обновляются раз в минуту. override (?time=21:30) — посмотреть
// карту в другое время суток (удобно для проверки дизайна). null, пока не известен часовой пояс.
export function useCityClock(timezone, override) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);
  return parseClock(override) ?? (timezone ? cityClock(timezone, new Date(now)) : null);
}
