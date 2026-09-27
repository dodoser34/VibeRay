import { PASSWORD_MIN_LENGTH } from '@/shared/config/validation';
import auth from '@/texts/auth.json';
import { format } from './format';

const labels = auth.passwordStrength;

// Проверка надёжности пароля, общая для формы и API (бэкенд повторяет те же правила).
const COMMON_PASSWORDS = new Set([
  '123456',
  '1234567',
  '12345678',
  '123456789',
  '1234567890',
  '111111',
  '000000',
  '123123',
  '654321',
  'qwerty',
  'qwerty123',
  'qwertyuiop',
  'password',
  'password1',
  'passw0rd',
  'iloveyou',
  'admin',
  'admin123',
  'welcome',
  'abc123',
  '1q2w3e4r',
  '1qaz2wsx',
  'zaq12wsx',
  'йцукен',
  'йцукенгш',
  'пароль',
  'kostanay',
  'костанай',
  'viberay',
]);

const LEVELS = [
  { label: labels.levels[0], colorVar: '--mood-angry' },
  { label: labels.levels[1], colorVar: '--mood-anxious' },
  { label: labels.levels[2], colorVar: '--mood-good' },
  { label: labels.levels[3], colorVar: '--mood-excellent' },
];

function isTrivial(password) {
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return true;
  if (/^(.)\1+$/.test(password)) return true; // «aaaaaaaa»
  const codes = [...password].map((c) => c.charCodeAt(0));
  const step = codes[1] - codes[0];
  return Math.abs(step) === 1 && codes.every((c, i) => i === 0 || c - codes[i - 1] === step);
}

function containsPersonal(password, { email = '', nickname = '' }) {
  const lower = password.toLowerCase();
  const parts = [email.split('@')[0], nickname].map((p) => p.trim().toLowerCase());
  return parts.some((p) => p.length >= 3 && lower.includes(p));
}

export function evaluatePassword(password, context = {}) {
  const checks = [
    {
      id: 'length',
      label: format(labels.checks.length, { min: PASSWORD_MIN_LENGTH }),
      required: true,
      ok: password.length >= PASSWORD_MIN_LENGTH,
    },
    {
      id: 'case',
      label: labels.checks.case,
      required: false,
      ok: /\p{Ll}/u.test(password) && /\p{Lu}/u.test(password),
    },
    { id: 'digit', label: labels.checks.digit, required: false, ok: /\d/.test(password) },
    {
      id: 'symbol',
      label: labels.checks.symbol,
      required: false,
      ok: /[^\p{L}\d\s]/u.test(password),
    },
    {
      id: 'common',
      label: labels.checks.common,
      required: true,
      ok: password.length > 0 && !isTrivial(password),
    },
    {
      id: 'personal',
      label: labels.checks.personal,
      required: true,
      ok: password.length > 0 && !containsPersonal(password, context),
    },
  ];
  const requiredOk = checks.filter((c) => c.required).every((c) => c.ok);
  const extras = checks.filter((c) => !c.required && c.ok).length + (password.length >= 12 ? 1 : 0);
  const level = requiredOk ? Math.min(3, extras) : 0;
  return {
    checks,
    level,
    ...LEVELS[level],
    // Принимаем «Средний» и лучше: все обязательные правила плюс хотя бы одно дополнительное.
    acceptable: requiredOk && extras >= 1,
  };
}
