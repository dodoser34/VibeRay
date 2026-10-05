import { useEffect, useRef, useState } from 'react';
import { createProblem } from '@/shared/api/endpoints/problems';
import { gsap, useGSAP } from '@/shared/animations/gsapSetup';
import { PROBLEM_CATEGORIES } from '@/shared/config/problemCategories';
import {
  PROBLEM_DESCRIPTION_MAX,
  PROBLEM_DESCRIPTION_MIN,
  PROBLEM_MAX_PHOTOS,
} from '@/shared/config/validation';
import { checkPhoto, preparePhoto } from '@/shared/lib/imageTools';
import { Button } from '@/shared/ui/Button';
import { CategoryIcon } from './CategoryIcon';
import { format } from '@/shared/lib/format';
import problemTexts from '@/texts/ru/problems.json';
import styles from './ReportProblem.module.css';
import { Icon } from '@/shared/ui/icons/Icon';

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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    photosRef.current = photos;
  });
  useEffect(() => () => photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url)), []);

  useGSAP(
    () => {
      gsap.fromTo(
        bodyRef.current,
        { x: direction.current * 24, autoAlpha: 0 },
        { x: 0, autoAlpha: 1, duration: 0.45, ease: 'power3.out' },
      );
    },
    { dependencies: [step], scope: rootRef },
  );

  const goTo = (next) => {
    direction.current = next > step ? 1 : -1;
    setError('');
    setStep(next);
    onStepChange?.(STEPS[next].key);
  };

  const chooseCategory = (code) => {
    setCategory(code);
    goTo(1);
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
      const photo = list.find((p) => p.id === id);
      if (photo) URL.revokeObjectURL(photo.url);
      return list.filter((p) => p.id !== id);
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
      });
      onCreated(problem);
    } catch (e) {
      setError(e.message);
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
        <button
          type="button"
          className={styles.close}
          data-ui="panel-close"
          onClick={onClose}
          aria-label={texts.cancel}
        >
          <Icon name="close" size={14} />
        </button>
      </header>

      <ol className={styles.progress} aria-hidden="true">
        {STEPS.map((s, i) => (
          <li key={s.key} data-state={i < step ? 'done' : i === step ? 'current' : 'todo'} />
        ))}
      </ol>

      <div ref={bodyRef} className={styles.body}>
        {step === 0 && (
          <div className={styles.categories} role="radiogroup" aria-label={texts.categoryLabel}>
            {PROBLEM_CATEGORIES.map((c) => (
              <button
                key={c.code}
                type="button"
                role="radio"
                aria-checked={category === c.code}
                className={styles.category}
                onClick={() => chooseCategory(c.code)}
              >
                <CategoryIcon category={c.code} size={26} />
                <span>{c.label}</span>
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
                onChange={(e) => setDescription(e.target.value)}
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
