import { useRef, useState } from 'react';
import { gsap, useGSAP } from '@/shared/animations/core/gsapSetup';
import { useCities, useCityDistricts } from '@/shared/hooks/useCities';
import { evaluatePassword } from '@/shared/lib/passwordStrength';
import { Button } from '@/shared/ui/controls/Button';
import auth from '@/texts/en/auth.json';
import { useAuth } from '../../model/useAuth';
import { STEP, STEPS, validateStep } from '../../lib/registerSteps';
import { RegisterPreview } from './RegisterPreview';
import { RegisterProgress } from './RegisterProgress';
import { AccountStep } from './steps/AccountStep';
import { AvatarStep } from './steps/AvatarStep';
import { CityStep } from './steps/CityStep';
import { DistrictStep } from './steps/DistrictStep';
import { NicknameStep } from './steps/NicknameStep';
import { PasswordStep } from './steps/PasswordStep';
import form from '../AuthForm.module.css';
import styles from './RegisterFlow.module.css';

// Регистрация по шагам: здесь — значения, проверка, отправка и анимация смены шага; поля каждого
// шага — в steps/. Сначала город (список всех городов), затем район этого города.
export function RegisterFlow({ onDistrictPreview, onSuccess, onSwitch }) {
  const { register } = useAuth();
  const texts = auth.register;
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
    city: null,
    district: null,
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const cities = useCities();
  const districts = useCityDistricts(values.city);
  const cityName = cities?.find((city) => city.slug === values.city)?.name;

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
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFormError('');
  };

  const goTo = (next) => {
    direction.current = next > step ? 1 : -1;
    setStep(next);
  };

  // Другой город — прежний район в нём не лежит.
  const chooseCity = (slug) => {
    if (slug === values.city) return;
    set('city', slug);
    set('district', null);
  };

  const chooseDistrict = (slug) => {
    set('district', slug);
    onDistrictPreview(slug);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const stepErrors = validateStep(step, values);
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
        homeCity: values.city,
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
      } else if (error.code === 'city_required' || error.code === 'city_not_found') {
        setErrors({ city: error.message });
        goTo(STEP.city);
      } else {
        setFormError(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const fieldProps = { values, errors, onChange: set };

  return (
    <form ref={formRef} className={form.form} onSubmit={handleSubmit} noValidate>
      <div className={form.intro} data-part>
        <h2 className={form.title}>{texts.title}</h2>
      </div>

      {step >= STEP.nickname && (
        <RegisterPreview
          avatar={values.avatar}
          nickname={values.nickname}
          cityName={cityName}
          districtName={districts?.find((district) => district.slug === values.district)?.name}
        />
      )}

      <RegisterProgress step={step} />

      <div ref={stepRef} className={styles.stepBody} data-part>
        {step === STEP.account && <AccountStep {...fieldProps} />}
        {step === STEP.password && <PasswordStep {...fieldProps} />}
        {step === STEP.nickname && <NicknameStep {...fieldProps} />}
        {step === STEP.avatar && <AvatarStep {...fieldProps} />}
        {step === STEP.city && (
          <CityStep cities={cities} value={values.city} error={errors.city} onChoose={chooseCity} />
        )}
        {step === STEP.district && (
          <DistrictStep districts={districts} value={values.district} onChoose={chooseDistrict} />
        )}
      </div>

      {formError && (
        <p className={form.formError} role="alert">
          {formError}
        </p>
      )}

      <div className={form.actions} data-part>
        {step > 0 && (
          <Button variant="ghost" size="lg" onClick={() => goTo(step - 1)}>
            {texts.back}
          </Button>
        )}
        <Button type="submit" size="lg" block loading={loading}>
          {step < STEPS.length - 1 ? texts.next : texts.create}
        </Button>
      </div>

      <p className={form.switch} data-part>
        {texts.haveAccount}{' '}
        <Button variant="text" onClick={onSwitch}>
          {texts.toLogin}
        </Button>
      </p>
    </form>
  );
}
