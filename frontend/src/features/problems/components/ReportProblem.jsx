import { useEffect, useRef, useState } from 'react';
import { createProblem } from '@/shared/api/endpoints/problems';
import { gsap, useGSAP } from '@/shared/animations/core/gsapSetup';
import { prefersReducedMotion } from '@/shared/hooks/useReducedMotion';
import { PROBLEM_CATEGORIES } from '@/shared/config/problemCategories';
import {
  PROBLEM_DESCRIPTION_MAX,
  PROBLEM_DESCRIPTION_MIN,
  PROBLEM_MAX_PHOTOS,
} from '@/shared/config/validation';
import { checkPhoto, preparePhoto } from '@/shared/lib/imageTools';
import { Button } from '@/shared/ui/controls/Button';
import { CloseButton } from '@/shared/ui/controls/CloseButton';
import { format } from '@/shared/lib/i18n/format';
import problemTexts from '@/texts/en/problems.json';
import { Icon } from '@/shared/ui/icons/Icon';
import { CategoryIcon } from './CategoryIcon';
import styles from './ReportProblem.module.css';

const texts = problemTexts.report;

const STEPS = [
  {
    key: 'category',
    get title() {
      return texts.steps.category;
    },
  },
  {
    key: 'place',
    get title() {
      return texts.steps.place;
    },
  },
  {
    key: 'details',
    get title() {
      return texts.steps.details;
    },
  },
];

// «Сообщить о проблеме»: тип → точка на карте → описание и фото → отправка. onStepChange('category'
// | 'place' | 'details') позволяет странице освободить карту для метки.
export function ReportProblem({ placement, districtName, onClose, onCreated, onStepChange }) {
  const rootRef = useRef(null);
  const bodyRef = useRef(null);
  const fileRef = useRef(null);
  const direction = useRef(1);
  const photosRef = useRef([]);
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState(null);
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState([]); // { id, file, url }
  const [anonymous, setAnonymous] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    photosRef.current = photos;
  });
  useEffect(() => () => photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url)), []);

  // Шаг въезжает с той стороны, куда идём; плитки категорий следом поднимаются по одной.
  const { context } = useGSAP(
    () => {
      gsap.fromTo(
        bodyRef.current,
        { x: direction.current * 24, autoAlpha: 0 },
        { x: 0, autoAlpha: 1, duration: 0.45, ease: 'power3.out' },
      );
      if (step === 0) {
        gsap.from('[data-category]', {
          y: 14,
          scale: 0.94,
          autoAlpha: 0,
          duration: 0.5,
          ease: 'back.out(1.6)',
          stagger: 0.035,
          delay: 0.08,
          clearProps: 'transform',
        });
      }
    },
    { dependencies: [step], scope: rootRef },
  );

  const goTo = (next) => {
    direction.current = next > step ? 1 : -1;
    setError('');
    setStep(next);
    onStepChange?.(STEPS[next].key);
  };

  // Выбранная плитка «нажимается» и отмечается рамкой — и только потом форма переходит к месту.
  // Анимация — в контексте компонента: закрыли форму раньше, чем она кончилась, — перехода не
  // будет.
  const chooseCategory = (code, tile) => {
    setCategory(code);
    if (prefersReducedMotion()) {
      goTo(1);
      return;
    }
    context.add(() => {
      gsap.fromTo(
        tile,
        { scale: 0.93 },
        { scale: 1, duration: 0.32, ease: 'back.out(3)', onComplete: () => goTo(1) },
      );
    });
  };

  const addPhotos = (event) => {
    const files = [...event.target.files];
    event.target.value = '';
    const room = PROBLEM_MAX_PHOTOS - photos.length;
    const rejected = files.map(checkPhoto).filter(Boolean);
    const accepted = files.filter((file) => !checkPhoto(file)).slice(0, room);
    if (rejected.length) setError(rejected[0]);
    else if (files.length > room)
      setError(format(texts.tooManyPhotos, { max: PROBLEM_MAX_PHOTOS }));
    else setError('');
    setPhotos((list) => [
      ...list,
      ...accepted.map((file) => ({
        id: crypto.randomUUID(),
        file,
        url: URL.createObjectURL(file),
      })),
    ]);
  };

  const removePhoto = (id) =>
    setPhotos((list) => {
      const photo = list.find((photo) => photo.id === id);
      if (photo) URL.revokeObjectURL(photo.url);
      return list.filter((photo) => photo.id !== id);
    });

  const submit = async () => {
    const text = description.trim();
    if (text.length < PROBLEM_DESCRIPTION_MIN) {
      setError(format(texts.descriptionTooShort, { min: PROBLEM_DESCRIPTION_MIN }));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const prepared = await Promise.all(photos.map((photo) => preparePhoto(photo.file)));
      const problem = await createProblem({
        category,
        location: placement.location,
        description: text,
        photos: prepared,
        isAnonymous: anonymous,
      });
      onCreated(problem);
    } catch (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  const length = description.trim().length;

  return (
    <section
      ref={rootRef}
      className={styles.root}
      aria-labelledby="report-title"
      data-ui="map-detail"
    >
      <header className={styles.header} data-sheet-drag>
        <div>
          <p className={styles.kicker}>
            {format(texts.kicker, { step: step + 1, total: STEPS.length })}
          </p>
          <h2 id="report-title" className={styles.title}>
            {STEPS[step].title}
          </h2>
        </div>
        <CloseButton label={texts.cancel} onClick={onClose} />
      </header>

      <ol className={styles.progress} aria-hidden="true">
        {STEPS.map((item, i) => (
          <li key={item.key} data-state={i < step ? 'done' : i === step ? 'current' : 'todo'} />
        ))}
      </ol>

      <div ref={bodyRef} className={styles.body}>
        {step === 0 && (
          <div className={styles.categories} role="radiogroup" aria-label={texts.categoryLabel}>
            {PROBLEM_CATEGORIES.map((option) => (
              <button
                key={option.code}
                type="button"
                role="radio"
                aria-checked={category === option.code}
                className={styles.category}
                data-category
                onClick={(event) => chooseCategory(option.code, event.currentTarget)}
              >
                <CategoryIcon category={option.code} size={26} />
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className={styles.place}>
            <p className={styles.lead}>{texts.placeLead}</p>
            {placement ? (
              <div className={styles.placed}>
                <span className={styles.placedDot} aria-hidden="true" />
                <div>
                  <p className={styles.placedName}>{districtName}</p>
                  <p className={styles.placedCoords}>
                    {placement.location[1].toFixed(5)}, {placement.location[0].toFixed(5)}
                  </p>
                </div>
              </div>
            ) : (
              <p className={styles.waiting}>{texts.placeWaiting}</p>
            )}
            <p className={styles.note}>{texts.placeNote}</p>
          </div>
        )}

        {step === 2 && (
          <div className={styles.details}>
            <label className={styles.textareaWrap}>
              <span className={styles.textareaLabel}>{texts.descriptionLabel}</span>
              <textarea
                className={styles.textarea}
                rows={5}
                maxLength={PROBLEM_DESCRIPTION_MAX}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={texts.descriptionPlaceholder}
              />
              <span className={styles.counter} data-short={length < PROBLEM_DESCRIPTION_MIN}>
                {length} / {PROBLEM_DESCRIPTION_MAX}
              </span>
            </label>

            <div className={styles.photos}>
              {photos.map((photo) => (
                <div key={photo.id} className={styles.photo}>
                  <img src={photo.url} alt={texts.photoAlt} />
                  <button
                    type="button"
                    className={styles.removePhoto}
                    onClick={() => removePhoto(photo.id)}
                    aria-label={texts.removePhoto}
                  >
                    <Icon name="close" size={10} />
                  </button>
                </div>
              ))}
              {photos.length < PROBLEM_MAX_PHOTOS && (
                <button
                  type="button"
                  className={styles.addPhoto}
                  onClick={() => fileRef.current.click()}
                >
                  <Icon name="camera" size={22} />
                  <span>{texts.addPhoto}</span>
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="visually-hidden"
                onChange={addPhotos}
                tabIndex={-1}
              />
            </div>
            <p className={styles.note}>{format(texts.photosNote, { max: PROBLEM_MAX_PHOTOS })}</p>

            <label className={styles.anonymous}>
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(event) => setAnonymous(event.target.checked)}
              />
              <span>
                <span className={styles.anonymousLabel}>{texts.anonymousLabel}</span>
                <span className={styles.note}>{texts.anonymousHint}</span>
              </span>
            </label>
          </div>
        )}
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <footer className={styles.actions}>
        {step > 0 && (
          <Button variant="ghost" size="lg" onClick={() => goTo(step - 1)} disabled={loading}>
            {texts.back}
          </Button>
        )}
        {step === 1 && (
          <Button size="lg" block disabled={!placement} onClick={() => goTo(2)}>
            {texts.next}
          </Button>
        )}
        {step === 2 && (
          <Button size="lg" block loading={loading} onClick={submit}>
            {texts.submit}
          </Button>
        )}
      </footer>
    </section>
  );
}
