import dictionaries from '@/texts/ru/dictionaries.json';
import { withLabels } from './withLabels';

// Коды должны совпадать с backend/app/models/enums.py (SupportTopic, ServiceState).
export const SUPPORT_TOPICS = withLabels(
  [
    { code: 'account' },
    { code: 'map' },
    { code: 'mood' },
    { code: 'problems' },
    { code: 'security' },
    { code: 'technical' },
    { code: 'other' },
  ],
  dictionaries.supportTopics,
);

export const SUPPORT_TOPIC_BY_CODE = Object.fromEntries(SUPPORT_TOPICS.map((t) => [t.code, t]));

// Состояние обращения для команды поддержки: новое → в работе → отвечено → закрыто. Новое и в работе
// — «без ответа».
export const SUPPORT_REQUEST_STATUSES = withLabels(
  [{ code: 'new' }, { code: 'in_progress' }, { code: 'answered' }, { code: 'closed' }],
  dictionaries.supportRequestStatuses,
);

export const OPEN_SUPPORT_STATUSES = ['new', 'in_progress'];

const SERVICE_STATES = withLabels(
  [
    {
      code: 'operational',
      colorVar: '--color-success',
    },
    { code: 'degraded', colorVar: '--color-alert' },
    { code: 'down', colorVar: '--color-danger' },
  ],
  dictionaries.serviceStates,
);

export const SERVICE_STATE_BY_CODE = Object.fromEntries(SERVICE_STATES.map((s) => [s.code, s]));
