import { EMAIL_PATTERN, NICKNAME_PATTERN } from '@/shared/config/validation';
import { evaluatePassword } from '@/shared/lib/passwordStrength';
import auth from '@/texts/en/auth.json';

// Шаги регистрации по порядку. Подписи читаются геттером: язык меняется на лету.
export const STEPS = ['account', 'password', 'nickname', 'avatar', 'district'].map((key) => ({
  key,
  get label() {
    return auth.register.steps[key];
  },
}));

export const STEP = Object.fromEntries(STEPS.map((step, i) => [step.key, i]));

// Ошибки полей текущего шага (пустой объект — шаг пройден).
export function validateStep(step, values) {
  const errors = {};
  if (step === STEP.account && !EMAIL_PATTERN.test(values.email)) {
    errors.email = auth.errors.emailTypo;
  }
  if (step === STEP.password) {
    if (!evaluatePassword(values.password, values).acceptable) {
      errors.password = auth.errors.passwordWeak;
    }
    if (values.confirm !== values.password) errors.confirm = auth.errors.passwordsDiffer;
  }
  if (step === STEP.nickname && !NICKNAME_PATTERN.test(values.nickname)) {
    errors.nickname = auth.errors.nicknameInvalid;
  }
  return errors;
}
