import dictionaries from '@/texts/dictionaries.json';

// Коды должны совпадать с backend/app/models/enums.py (StatsPeriod).
export const PERIOD_CODES = ['day', 'week', 'month', 'year', 'all'];

const period = (code) => ({ code, label: dictionaries.periods[code] });

// Карта показывает текущее настроение; дашборд города смотрит на более длинную историю.
export const MOOD_PERIODS = ['day', 'week', 'month'].map(period);
export const STATS_PERIODS = ['month', 'year', 'all'].map(period);
export const DEFAULT_STATS_PERIOD = 'year';
