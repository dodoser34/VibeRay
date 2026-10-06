import { useState } from 'react';
import { useHref } from 'react-router';
import { confirmProblem } from '@/shared/api/endpoints/problems';
import { CATEGORY_BY_CODE } from '@/shared/config/problemCategories';
import {
  REJECTED_STATUS,
  REJECTION_REASON_BY_CODE,
  STATUS_BY_CODE,
} from '@/shared/config/problemStatuses';
import { useLocalizedNavigate } from '@/shared/hooks/useLocalizedNavigate';
import { useShare } from '@/shared/hooks/useShare';
import { format } from '@/shared/lib/format';
import { formatDate } from '@/shared/lib/formatDate';
import { localizePath } from '@/shared/lib/language';
import { plural } from '@/shared/lib/plural';
import { Avatar } from '@/shared/ui/avatar/Avatar';
import { Button } from '@/shared/ui/controls/Button';
import { CategoryIcon } from './CategoryIcon';
import { StatusChip } from './StatusChip';
import { StatusTimeline } from './StatusTimeline';
import problemTexts from '@/texts/ru/problems.json';
import styles from './ProblemCard.module.css';
import { Icon } from '@/shared/ui/icons/Icon';

const texts = problemTexts.card;

// Карточка проблемы на карте. У неё свой адрес (/map/:city/problem/:id) — им можно поделиться,
// чтобы соседи подтвердили. Своё сообщение подтвердить нельзя, уже подтверждённое — второй раз тоже.
// Отклонённое модератором сообщение открывает только автор: вместо подтверждения — причина и, для
// дубля, ссылка на исходную проблему.
export function ProblemCard({
  problem,
  citySlug,
  districtName,
  isGuest,
  onRequireAuth,
  onUpdated,
  onClose,
}) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const { state: shareState, share } = useShare();
  const href = useHref(localizePath(`/map/${citySlug}/problem/${problem.id}`));
  const navigate = useLocalizedNavigate();
  const rejected = problem.status === REJECTED_STATUS.code;
  const category = CATEGORY_BY_CODE[problem.category].label;

  const handleConfirm = async () => {
    if (isGuest) return onRequireAuth();
    setLoading(true);
    setMessage('');
    try {
      onUpdated(await confirmProblem(problem.id));
      setMessage(texts.confirmed);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = () =>
    share({
      url: new URL(href, window.location.origin).href,
      title: format(texts.shareTitle, { category, district: districtName }),
    });

  // Анонимную проблему жители видят без автора; сам автор видит свой ник с пометкой.
  const authorLabel = !problem.author
    ? texts.anonymous
    : problem.is_anonymous
      ? format(texts.anonymousMine, { nickname: problem.author.nickname })
      : problem.author.nickname;
  const count = problem.confirmations_count;

  return (
    <article className={styles.root} aria-label={texts.label} data-ui="map-detail">
      <header className={styles.header} data-sheet-drag>
        <span
          className={styles.icon}
          style={{ '--status-color': `var(${STATUS_BY_CODE[problem.status].colorVar})` }}
        >
          <CategoryIcon category={problem.category} size={22} />
        </span>
        <div className={styles.heading}>
          <p className={styles.kicker}>{districtName}</p>
          <h3 className={styles.title}>{category}</h3>
        </div>
        <div className={styles.tools}>
          <button
            type="button"
            className={styles.tool}
            onClick={handleShare}
            aria-label={texts.share}
            title={texts.share}
            data-ui="panel-tool"
          >
            <Icon name="link" size={14} />
          </button>
          <button
            type="button"
            className={styles.tool}
            data-ui="panel-close"
            onClick={onClose}
            aria-label={texts.close}
          >
            <Icon name="close" size={12} />
          </button>
          {shareState !== 'idle' && (
            <span className={styles.shareNote} role="status" data-state={shareState}>
              {shareState === 'copied' ? texts.copied : texts.shareFailed}
            </span>
          )}
        </div>
      </header>

      <div className={styles.badges}>
        <StatusChip status={problem.status} />
        {problem.is_mine && <span className={styles.mine}>{texts.mine}</span>}
      </div>

      <p className={styles.description}>{problem.description}</p>

      {problem.photos?.length > 0 && (
        <div className={styles.photos}>
          {problem.photos.map((photo) => (
            <a
              key={photo.url}
              href={photo.url}
              target="_blank"
              rel="noreferrer"
              className={styles.photo}
            >
              <img src={photo.url} alt={texts.photoAlt} loading="lazy" />
            </a>
          ))}
        </div>
      )}

      <StatusTimeline status={problem.status} history={problem.history} label={texts.statusLabel} />

      <footer className={styles.footer}>
        <span className={styles.author}>
          {problem.author ? (
            <Avatar src={problem.author.avatar_url} size={24} />
          ) : (
            <span className={styles.anonymousAvatar} aria-hidden="true">
              <Icon name="mask" size={14} />
            </span>
          )}
          <span>
            {authorLabel} · {formatDate(problem.created_at)}
          </span>
        </span>
        <span className={styles.count}>
          <Icon name="check" size={12} />
          {format(texts.confirmations, {
            count,
            people: plural(count, texts.confirmationsForms),
          })}
        </span>
      </footer>

      {rejected ? (
        <section className={styles.rejected} aria-label={texts.rejectedTitle}>
          <h4 className={styles.rejectedTitle}>{texts.rejectedTitle}</h4>
          <p className={styles.rejectedReason}>
            {REJECTION_REASON_BY_CODE[problem.rejection_reason]?.label}
          </p>
          <p className={styles.rejectedNote}>{texts.rejectedNote}</p>
          {problem.duplicate_of && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/map/${citySlug}/problem/${problem.duplicate_of}`)}
            >
              {texts.openOriginal}
            </Button>
          )}
        </section>
      ) : problem.is_mine ? (
        <p className={styles.note}>{texts.mineNote}</p>
      ) : (
        <Button
          variant="ghost"
          block
          loading={loading}
          disabled={problem.confirmed_by_me}
          onClick={handleConfirm}
        >
          {problem.confirmed_by_me ? texts.confirmedByMe : texts.confirm}
        </Button>
      )}
      {message && (
        <p className={styles.message} role="status">
          {message}
        </p>
      )}
    </article>
  );
}
