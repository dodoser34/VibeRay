import dictionaries from '@/texts/en/dictionaries.json';
import { withLabels } from './withLabels';

// Коды общие с бэкендом: перечисление StatsPeriod (будущий backend/app/models/enums.py).
export const PERIOD_CODES = ['day', 'week', 'month', 'year', 'all'];

const periods = (codes) =>
  withLabels(
    codes.map((code) => ({ code })),
    dictionaries.periods,
  );

// Карта показывает текущее настроение; дашборд города смотрит на более длинную историю.
export const MOOD_PERIODS = periods(['day', 'week', 'month']);
export const STATS_PERIODS = periods(['month', 'year', 'all']);
export const DEFAULT_STATS_PERIOD = 'year';
