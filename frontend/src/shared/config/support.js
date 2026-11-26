import dictionaries from '@/texts/en/dictionaries.json';
import { withLabels } from './withLabels';

// Коды общие с бэкендом: перечисления SupportTopic и ServiceState (будущий
// backend/app/models/enums.py).
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

export const SUPPORT_TOPIC_BY_CODE = Object.fromEntries(
  SUPPORT_TOPICS.map((topic) => [topic.code, topic]),
);

// Состояние обращения для команды поддержки: новое → в работе → отвечено → закрыто.
export const SUPPORT_REQUEST_STATUSES = withLabels(
  [{ code: 'new' }, { code: 'in_progress' }, { code: 'answered' }, { code: 'closed' }],
  dictionaries.supportRequestStatuses,
);

// Обращения «без ответа».
export const OPEN_SUPPORT_STATUSES = ['new', 'in_progress'];

const SERVICE_STATES = withLabels(
  [
    { code: 'operational', colorVar: '--color-success' },
    { code: 'degraded', colorVar: '--color-alert' },
    { code: 'down', colorVar: '--color-danger' },
  ],
  dictionaries.serviceStates,
);

export const SERVICE_STATE_BY_CODE = Object.fromEntries(
  SERVICE_STATES.map((state) => [state.code, state]),
);
