import { useRef, useState } from 'react';
import { gsap, useGSAP } from '@/shared/animations/gsapSetup';
import { EMAIL_PATTERN, NICKNAME_PATTERN } from '@/shared/config/validation';
import { evaluatePassword } from '@/shared/lib/passwordStrength';
import { Avatar, AVATAR_PRESETS } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { TextField } from '@/shared/ui/TextField';
import { useAuth } from '../model/useAuth';
import { PasswordField } from './PasswordField';
import { PasswordStrength } from './PasswordStrength';
import { format } from '@/shared/lib/format';
import auth from '@/texts/ru/auth.json';
import styles from './PassForms.module.css';

const texts = auth.register;

const STEPS = [
  { key: 'account', label: texts.steps.account },
  { key: 'password', label: texts.steps.password },
  { key: 'nickname', label: texts.steps.nickname },
  { key: 'avatar', label: texts.steps.avatar },
  { key: 'district', label: texts.steps.district },
];
const STEP = Object.fromEntries(STEPS.map((s, i) => [s.key, i]));
// Заполняет шаг email (тело шага держит одну высоту на всех шагах, чтобы карточка не прыгала).
const PERKS = [
  {
    text: texts.perks.mood,
    icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8.5 14.5c1.9 1.6 5.1 1.6 7 0M9 9.5h.01M15 9.5h.01',
  },
  {
    text: texts.perks.problems,
    icon: 'M12 21s-6.5-5.4-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.6 12 21 12 21Zm0-13.5v3.5M12 14h.01',
  },
  {
    text: texts.perks.privacy,
    icon: 'M6 11V8a6 6 0 0 1 12 0v3M5 11h14v10H5z',
  },
];
// Готовые ники для шага ника (все подходят под NICKNAME_PATTERN).
const NICK_IDEAS = texts.nicknameIdeas;

function validate(step, values) {
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

export function RegisterFlow({ districts, onDistrictPreview, onSuccess, onSwitch }) {
  const { register } = useAuth();
  const formRef = useRef(null);
  const stepRef = useRef(null);
  const direction = useRef(1);
  const prevStep = useRef(null);
  const [step, setStep] = useState(0);
  const [values, setValues] = useState({
    email: '',
    password: '',
    confirm: '',
    nickname: '',
    avatar: 'preset:0',
    district: null,
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  useGSAP(
    () => {
      // первую отрисовку собирает AuthPanel; анимируем только настоящую смену шага
      if (prevStep.current === null || prevStep.current === step) {
        prevStep.current = step;
        return;
      }
      prevStep.current = step;
      gsap.fromTo(
        stepRef.current,
        { x: direction.current * 28, autoAlpha: 0 },
        { x: 0, autoAlpha: 1, duration: 0.45, ease: 'power3.out' },
      );
    },
    { dependencies: [step], scope: formRef },
  );

  const set = (field, value) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
    setFormError('');
  };

  const goTo = (next) => {
    direction.current = next > step ? 1 : -1;
    setStep(next);
  };

  const chooseDistrict = (slug) => {
    set('district', slug);
    onDistrictPreview(slug);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const stepErrors = validate(step, values);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length) {
      gsap.fromTo(
        stepRef.current,
        { x: -8 },
        { x: 0, duration: 0.5, ease: 'elastic.out(1.2, 0.3)' },
      );
      return;
    }
    if (step < STEPS.length - 1) return goTo(step + 1);

    // Ник известен только сейчас: пароль не должен содержать и его.
    if (!evaluatePassword(values.password, values).acceptable) {
      setErrors({ password: auth.errors.passwordPersonal });
      return goTo(STEP.password);
    }

    setLoading(true);
    try {
      const user = await register({
        email: values.email,
        password: values.password,
        nickname: values.nickname,
        avatarUrl: values.avatar,
        homeDistrict: values.district,
      });
      onSuccess(user);
    } catch (error) {
      if (error.code === 'email_taken') {
        setErrors({ email: error.message });
        goTo(STEP.account);
      } else if (error.code === 'weak_password') {
        setErrors({ password: error.message });
        goTo(STEP.password);
      } else if (error.code === 'nickname_taken') {
        setErrors({ nickname: error.message });
        goTo(STEP.nickname);
      } else {
        setFormError(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const passwordCheck = evaluatePassword(values.password, values);
  const districtName = districts.find((d) => d.slug === values.district)?.name;

  return (
    <form ref={formRef} className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.intro} data-part>
        <h2 className={styles.title}>{texts.title}</h2>
      </div>

      {step >= STEP.nickname && (
        <div className={styles.preview}>
          <Avatar src={values.avatar} size={52} />
          <div className={styles.previewText}>
            <span className={styles.previewName}>
              {values.nickname || texts.previewNicknamePlaceholder}
            </span>
            <span className={styles.previewMeta}>
              {texts.previewResident}
              {districtName ? ` · ${districtName}` : ''}
            </span>
          </div>
          <span className={styles.lock} title={texts.previewPrivacyTitle}>
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
              <path d="M4 7V5a4 4 0 0 1 8 0v2M3 7h10v7H3z" />
            </svg>
            {texts.previewPrivacy}
          </span>
        </div>
      )}

      <ol className={styles.steps} aria-label={texts.stepsLabel} data-part>
        {STEPS.map((s, i) => (
          <li
            key={s.key}
            className={styles.stepItem}
            data-state={i < step ? 'done' : i === step ? 'current' : 'todo'}
            aria-current={i === step ? 'step' : undefined}
          >
            <span className={styles.stepBar} />
            <span className={styles.stepLabel}>{s.label}</span>
          </li>
        ))}
      </ol>

      <div ref={stepRef} className={styles.stepBody} data-part>
        {step === STEP.account && (
          <div className={styles.fields}>
            <TextField
              label={auth.fields.email}
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={(e) => set('email', e.target.value)}
              error={errors.email}
              hint={texts.emailHint}
            />
            <ul className={styles.perks} aria-label={texts.perksLabel}>
              {PERKS.map((perk) => (
                <li key={perk.text} className={styles.perk}>
                  <svg className={styles.perkIcon} viewBox="0 0 24 24" aria-hidden="true">
                    <path d={perk.icon} />
                  </svg>
                  {perk.text}
                </li>
              ))}
            </ul>
          </div>
        )}

        {step === STEP.password && (
          <div className={styles.fields}>
            <PasswordField
              label={auth.fields.password}
              autoComplete="new-password"
              value={values.password}
              onChange={(e) => set('password', e.target.value)}
              error={errors.password}
            />
            {values.password && <PasswordStrength result={passwordCheck} />}
            <PasswordField
              label={auth.fields.passwordRepeat}
              autoComplete="new-password"
              value={values.confirm}
              onChange={(e) => set('confirm', e.target.value)}
              error={errors.confirm}
            />
          </div>
        )}

        {step === STEP.nickname && (
          <div className={styles.fields}>
            <TextField
              label={auth.fields.nickname}
              autoComplete="nickname"
              maxLength={24}
              value={values.nickname}
              onChange={(e) => set('nickname', e.target.value)}
              error={errors.nickname}
              hint={texts.nicknameHint}
            />
            <div className={styles.ideas}>
              <span className={styles.ideasLabel}>{texts.ideasLabel}</span>
              {NICK_IDEAS.map((idea) => (
                <button
                  key={idea}
                  type="button"
                  className={styles.idea}
                  data-active={values.nickname === idea || undefined}
                  onClick={() => set('nickname', idea)}
                >
                  {idea}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === STEP.avatar && (
          <fieldset className={styles.choices}>
            <legend className={styles.legend}>{texts.avatarLegend}</legend>
            <div className={styles.avatarGrid}>
              {AVATAR_PRESETS.map((_, i) => {
                const src = `preset:${i}`;
                return (
                  <label key={src} className={styles.avatarOption}>
                    <input
                      type="radio"
                      name="avatar"
                      className="visually-hidden"
                      checked={values.avatar === src}
                      onChange={() => set('avatar', src)}
                    />
                    <Avatar
                      src={src}
                      size={48}
                      label={format(texts.avatarOption, { number: i + 1 })}
                    />
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        {step === STEP.district && (
          <fieldset className={styles.choices}>
            <legend className={styles.legend}>{texts.districtLegend}</legend>
            <p className={styles.note}>{texts.districtNote}</p>
            <div className={styles.districtGrid}>
              {districts.map((d) => (
                <label key={d.slug} className={styles.districtOption}>
                  <input
                    type="radio"
                    name="district"
                    className="visually-hidden"
                    checked={values.district === d.slug}
                    onChange={() => chooseDistrict(d.slug)}
                  />
                  <span>{d.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </div>

      {formError && (
        <p className={styles.formError} role="alert">
          {formError}
        </p>
      )}

      <div className={styles.actions} data-part>
        {step > 0 && (
          <Button variant="ghost" size="lg" onClick={() => goTo(step - 1)}>
            {texts.back}
          </Button>
        )}
        <Button type="submit" size="lg" block loading={loading}>
          {step < STEPS.length - 1 ? texts.next : texts.create}
        </Button>
      </div>

      <p className={styles.switch} data-part>
        {texts.haveAccount}{' '}
        <Button variant="text" onClick={onSwitch}>
          {texts.toLogin}
        </Button>
      </p>
    </form>
  );
}
