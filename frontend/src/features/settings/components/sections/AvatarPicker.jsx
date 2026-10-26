import { useRef, useState } from 'react';
import { checkPhoto, preparePhoto } from '@/shared/lib/imageTools';
import { format } from '@/shared/lib/format';
import { Avatar, AVATAR_PRESETS } from '@/shared/ui/avatar/Avatar';
import texts from '@/texts/ru/settings.json';
import styles from './AvatarPicker.module.css';
import { Icon } from '@/shared/ui/icons/Icon';

const PRESETS = AVATAR_PRESETS.map((_, i) => `preset:${i}`);

// Готовые аватары и своё фото. customSrc — фото, которое уже можно выбрать (текущее загруженное
// или только что добавленное); onUpload получает фото, перекодированное без EXIF.
export function AvatarPicker({ value, customSrc, onChange, onUpload }) {
  const inputRef = useRef(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const pickFile = async (event) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    const problem = checkPhoto(file);
    setError(problem ?? '');
    if (problem) return;
    setBusy(true);
    try {
      onUpload(await preparePhoto(file));
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  const option = (src, label) => (
    <label key={src} className={styles.option}>
      <input
        type="radio"
        name="avatar"
        className="visually-hidden"
        checked={value === src}
        onChange={() => onChange(src)}
      />
      <Avatar src={src} size={52} label={label} />
    </label>
  );

  return (
    <fieldset className={styles.picker}>
      <legend className={styles.legend}>{texts.profile.avatarLegend}</legend>
      <div className={styles.grid} data-ui="settings-avatar-grid">
        {PRESETS.map((src, i) =>
          option(src, format(texts.profile.avatarOption, { number: i + 1 })),
        )}
        {customSrc && option(customSrc, texts.profile.uploaded)}
        <button
          type="button"
          className={styles.upload}
          onClick={() => inputRef.current.click()}
          aria-busy={busy || undefined}
          disabled={busy}
        >
          <Icon name="camera" />
          <span>{texts.profile.upload}</span>
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="visually-hidden"
        tabIndex={-1}
        onChange={pickFile}
      />
      <p className={error ? styles.error : styles.hint} role={error ? 'alert' : undefined}>
        {error || texts.profile.uploadHint}
      </p>
    </fieldset>
  );
}
