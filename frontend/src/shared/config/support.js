import dictionaries from '@/texts/ru/dictionaries.json';

// Коды должны совпадать с backend/app/models/enums.py (SupportTopic, ServiceState).
export const SUPPORT_TOPICS = [
  { code: 'account', label: dictionaries.supportTopics.account },
  { code: 'map', label: dictionaries.supportTopics.map },
  { code: 'mood', label: dictionaries.supportTopics.mood },
  { code: 'problems', label: dictionaries.supportTopics.problems },
  { code: 'security', label: dictionaries.supportTopics.security },
  { code: 'technical', label: dictionaries.supportTopics.technical },
  { code: 'other', label: dictionaries.supportTopics.other },
];

export const SUPPORT_TOPIC_BY_CODE = Object.fromEntries(SUPPORT_TOPICS.map((t) => [t.code, t]));

const SERVICE_STATES = [
  {
    code: 'operational',
    label: dictionaries.serviceStates.operational,
    colorVar: '--color-success',
  },
  { code: 'degraded', label: dictionaries.serviceStates.degraded, colorVar: '--color-alert' },
  { code: 'down', label: dictionaries.serviceStates.down, colorVar: '--color-danger' },
];

export const SERVICE_STATE_BY_CODE = Object.fromEntries(SERVICE_STATES.map((s) => [s.code, s]));
