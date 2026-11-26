import { PASSWORD_MIN_LENGTH } from '@/shared/config/validation';
import auth from '@/texts/en/auth.json';
import { format } from './i18n/format';

const labels = auth.passwordStrength;

// Пароли из словарей перебора и очевидные для сайта слова: такой пароль не принимается.
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

// Подпись уровня читается при обращении: язык меняется на лету.
const LEVELS = ['--mood-angry', '--mood-anxious', '--mood-good', '--mood-excellent'].map(
  (colorVar, index) => ({
    get label() {
      return labels.levels[index];
    },
    colorVar,
  }),
);

function isTrivial(password) {
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return true;
  if (/^(.)\1+$/.test(password)) return true; // «aaaaaaaa»
  const codes = [...password].map((character) => character.charCodeAt(0));
  const step = codes[1] - codes[0];
  return Math.abs(step) === 1 && codes.every((code, i) => i === 0 || code - codes[i - 1] === step);
}

function containsPersonal(password, { email = '', nickname = '' }) {
  const lower = password.toLowerCase();
  const parts = [email.split('@')[0], nickname].map((part) => part.trim().toLowerCase());
  return parts.some((part) => part.length >= 3 && lower.includes(part));
}

// Надёжность пароля для формы; бэкенд повторяет те же правила.
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
  const requiredOk = checks.filter((check) => check.required).every((check) => check.ok);
  const extras =
    checks.filter((check) => !check.required && check.ok).length + (password.length >= 12 ? 1 : 0);
  const level = requiredOk ? Math.min(3, extras) : 0;
  return {
    checks,
    level,
    ...LEVELS[level],
    // Принимаем «Средний» и лучше: все обязательные правила плюс хотя бы одно дополнительное.
    acceptable: requiredOk && extras >= 1,
  };
}
