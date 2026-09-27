import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth';
import { createSupportRequest } from '@/shared/api/endpoints/support';
import { SUPPORT_TOPICS } from '@/shared/config/support';
import {
  EMAIL_PATTERN,
  PHOTO_TYPES,
  SUPPORT_FILE_MAX_BYTES,
  SUPPORT_FILE_TYPES,
  SUPPORT_MAX_FILES,
  SUPPORT_MESSAGE_MAX,
  SUPPORT_MESSAGE_MIN,
} from '@/shared/config/validation';
import { preparePhoto } from '@/shared/lib/imageTools';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { TextField } from '@/shared/ui/TextField';
import { format } from '@/shared/lib/format';
import supportTexts from '@/texts/support.json';
import styles from './SupportRequestForm.module.css';

const texts = supportTexts.form;

const formatSize = (bytes) =>
  bytes < 1024 * 1024
    ? format(texts.sizeKb, { size: Math.ceil(bytes / 1024) })
    : format(texts.sizeMb, { size: (bytes / 1024 / 1024).toFixed(1) });

// Обращение в поддержку. Доступно всем (пишут и те, кто не может войти); вошедшему пользователю
// email для ответа подставляется из его профиля и никому больше не показывается.
export function SupportRequestForm({ initialTopic, onClose }) {
  const { user } = useAuth();
  const fileRef = useRef(null);
  const [topic, setTopic] = useState(initialTopic ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState([]);
  const [fileError, setFileError] = useState(null);
  const [status, setStatus] = useState({ state: 'idle' });
  const [touched, setTouched] = useState(false);

  const previewsRef = useRef(new Set());

  useEffect(() => {
    const previews = previewsRef.current;
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const removeFile = (index) => {
    const preview = files[index].preview;
    if (preview) {
      URL.revokeObjectURL(preview);
      previewsRef.current.delete(preview);
    }
    setFiles((current) => current.filter((_, k) => k !== index));
  };

  const length = message.trim().length;
  const errors = {
    topic: !topic && texts.errors.topic,
    email: !EMAIL_PATTERN.test(email.trim()) && texts.errors.email,
    message:
      length < SUPPORT_MESSAGE_MIN && format(texts.errors.message, { min: SUPPORT_MESSAGE_MIN }),
  };
  const valid = !errors.topic && !errors.email && !errors.message;

  const addFiles = async (event) => {
    const picked = [...event.target.files];
    event.target.value = '';
    setFileError(null);
    const room = SUPPORT_MAX_FILES - files.length;
    if (picked.length > room)
      setFileError(format(texts.errors.tooManyFiles, { max: SUPPORT_MAX_FILES }));
    const accepted = [];
    for (const file of picked.slice(0, room)) {
      if (!SUPPORT_FILE_TYPES.includes(file.type)) {
        setFileError(texts.errors.fileType);
        continue;
      }
      if (file.size > SUPPORT_FILE_MAX_BYTES) {
        setFileError(texts.errors.fileSize);
        continue;
      }
      if (PHOTO_TYPES.includes(file.type)) {
        // Скриншоты и фото теряют EXIF (геометку, модель телефона) до того, как покинут устройство.
        const blob = await preparePhoto(file);
        const name = `${file.name.replace(/\.[^.]+$/, '')}.jpg`;
        const clean = new File([blob], name, { type: 'image/jpeg' });
        const preview = URL.createObjectURL(clean);
        previewsRef.current.add(preview);
        accepted.push({ file: clean, preview });
      } else {
        accepted.push({ file, preview: null });
      }
    }
    setFiles((current) => [...current, ...accepted]);
  };

  const submit = async (event) => {
    event.preventDefault();
    setTouched(true);
    if (!valid || status.state === 'sending') return;
    setStatus({ state: 'sending' });
    try {
      const ticket = await createSupportRequest({
        topic,
        email: email.trim(),
        message: message.trim(),
        files: files.map((item) => item.file),
      });
      setStatus({ state: 'done', id: ticket.id });
    } catch (error) {
      setStatus({ state: 'error', message: error.message });
    }
  };

  if (status.state === 'done') {
    return (
      <Modal title={texts.done.title} onClose={onClose} width={480}>
        <div className={styles.done}>
          <span className={styles.check} aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
          </span>
          <p className={styles.doneTitle}>{format(texts.done.number, { id: status.id })}</p>
          <p className={styles.doneText}>{format(texts.done.text, { email: email.trim() })}</p>
          <Button onClick={onClose}>{texts.done.close}</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={texts.title} onClose={onClose} width={560}>
      <form className={styles.form} onSubmit={submit} noValidate>
        <fieldset className={styles.topics}>
          <legend className={styles.legend}>{texts.topicLegend}</legend>
          <div className={styles.topicList}>
            {SUPPORT_TOPICS.map((item) => (
              <label key={item.code} className={styles.topic}>
                <input
                  type="radio"
                  name="topic"
                  value={item.code}
                  checked={topic === item.code}
                  onChange={() => setTopic(item.code)}
                  className="visually-hidden"
                />
                <span className={styles.topicLabel}>{item.label}</span>
              </label>
            ))}
          </div>
          {touched && errors.topic && <p className={styles.error}>{errors.topic}</p>}
        </fieldset>

        <TextField
          label={texts.emailLabel}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={touched ? errors.email : null}
          hint={texts.emailHint}
        />

        <label className={styles.textareaWrap}>
          <span className={styles.textareaLabel}>{texts.messageLabel}</span>
          <textarea
            className={styles.textarea}
            rows={5}
            maxLength={SUPPORT_MESSAGE_MAX}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={texts.messagePlaceholder}
          />
          <span className={styles.counter}>
            {length} / {SUPPORT_MESSAGE_MAX}
          </span>
        </label>
        {touched && errors.message && <p className={styles.error}>{errors.message}</p>}

        <div className={styles.files}>
          {files.map((item, i) => (
            <div key={item.preview ?? `${item.file.name}-${i}`} className={styles.file}>
              {item.preview ? (
                <img src={item.preview} alt="" className={styles.thumb} />
              ) : (
                <span className={styles.docIcon} aria-hidden="true">
                  {texts.fileBadge}
                </span>
              )}
              <span className={styles.fileInfo}>
                <span className={styles.fileName}>{item.file.name}</span>
                <span className={styles.fileSize}>{formatSize(item.file.size)}</span>
              </span>
              <button
                type="button"
                className={styles.removeFile}
                onClick={() => removeFile(i)}
                aria-label={format(texts.removeFile, { name: item.file.name })}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M3 3l10 10M13 3L3 13" />
                </svg>
              </button>
            </div>
          ))}
          {files.length < SUPPORT_MAX_FILES && (
            <button type="button" className={styles.attach} onClick={() => fileRef.current.click()}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m20 11.5-8 8a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L9.7 17.2a1.7 1.7 0 0 1-2.4-2.4L15 7.2" />
              </svg>
              {texts.attach}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept={SUPPORT_FILE_TYPES.join(',')}
            multiple
            className="visually-hidden"
            onChange={addFiles}
            tabIndex={-1}
          />
          <p className={fileError ? styles.error : styles.note}>
            {fileError ?? format(texts.filesNote, { max: SUPPORT_MAX_FILES })}
          </p>
        </div>

        {status.state === 'error' && (
          <p className={styles.error} role="alert">
            {status.message}
          </p>
        )}

        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose}>
            {texts.cancel}
          </Button>
          <Button type="submit" loading={status.state === 'sending'}>
            {texts.submit}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
