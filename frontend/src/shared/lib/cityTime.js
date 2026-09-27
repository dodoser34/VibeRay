// Время в городе — по его часовому поясу, а не по часам посетителя: карта Костаная ночью тёмная,
// даже если её открыли из другого часового пояса.
export function cityClock(timeZone, now = new Date()) {
  const parts = new Intl.DateTimeFormat('ru-RU', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const value = (type) => parts.find((part) => part.type === type).value;
  const hour = Number(value('hour'));
  const minute = Number(value('minute'));
  return { hour: hour + minute / 60, label: `${value('hour')}:${value('minute')}` };
}

// «21:30» → { hour: 21.5, label: '21:30' } или null, если строка не время.
export function parseClock(text) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(text ?? '');
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return { hour: hour + minute / 60, label: `${String(hour).padStart(2, '0')}:${match[2]}` };
}

export function dayPhase(hour) {
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 17) return 'day';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}
