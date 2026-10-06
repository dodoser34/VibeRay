import { useState } from 'react';
import { getSupportRequests, updateSupportRequest } from '@/shared/api/endpoints/moderation';
import {
  OPEN_SUPPORT_STATUSES,
  SUPPORT_REQUEST_STATUSES,
  SUPPORT_TOPIC_BY_CODE,
} from '@/shared/config/support';
import { useRequest } from '@/shared/hooks/useRequest';
import { format } from '@/shared/lib/format';
import { formatRelative } from '@/shared/lib/formatDate';
import { plural } from '@/shared/lib/plural';
import { OptionGroup } from '@/shared/ui/controls/OptionGroup';
import texts from '@/texts/ru/moderation.json';
import styles from './SupportInbox.module.css';

// Фильтр → статусы обращений; «open» — новые и те, что в работе.
const FILTERS = {
  open: OPEN_SUPPORT_STATUSES,
  answered: ['answered'],
  closed: ['closed'],
  all: SUPPORT_REQUEST_STATUSES.map((s) => s.code),
};

// Обращения из формы поддержки: тема, почта для ответа (видна только поддержке), текст. Ответ —
// письмом; статус ведёт модератор: новое → в работе → отвечено → закрыто.
export function SupportInbox({ onChanged }) {
  const [filter, setFilter] = useState('open');
  const [busy, setBusy] = useState(null);
  const requests = useRequest('moderation:support', getSupportRequests);
  const items = (requests.data ?? []).filter((r) => FILTERS[filter].includes(r.status));

  const changeStatus = async (request, status) => {
    setBusy(request.id);
    try {
      await updateSupportRequest(request.id, status);
      requests.reload();
      onChanged();
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className={styles.inbox} aria-label={texts.support.title}>
      <OptionGroup
        label={texts.support.filterLabel}
        value={filter}
        onChange={setFilter}
        options={Object.keys(FILTERS).map((code) => ({ code, label: texts.support.filters[code] }))}
      />

      {!requests.data && <p className={styles.empty}>{texts.support.loading}</p>}
      {requests.data && items.length === 0 && <p className={styles.empty}>{texts.support.empty}</p>}

      <ul className={styles.list}>
        {items.map((request) => (
          <li key={request.id} className={styles.item} data-status={request.status}>
            <header className={styles.header}>
              <span className={styles.number}>{request.id}</span>
              <span className={styles.topic}>{SUPPORT_TOPIC_BY_CODE[request.topic].label}</span>
              <time className={styles.time} dateTime={request.created_at}>
                {formatRelative(request.created_at)}
              </time>
            </header>
            <p className={styles.message}>{request.message}</p>
            <footer className={styles.footer} data-ui="moderation-request-footer">
              <span className={styles.email}>{request.email}</span>
              {request.files_count > 0 && (
                <span className={styles.files}>
                  {format(texts.support.files, {
                    count: request.files_count,
                    forms: plural(request.files_count, texts.support.fileForms),
                  })}
                </span>
              )}
              <span className={styles.spacer} />
              <a
                className={styles.reply}
                href={`mailto:${request.email}?subject=${encodeURIComponent(
                  format(texts.support.replySubject, { id: request.id }),
                )}`}
              >
                {texts.support.reply}
              </a>
              <select
                className={styles.status}
                value={request.status}
                disabled={busy === request.id}
                aria-label={format(texts.support.statusLabel, { id: request.id })}
                onChange={(event) => changeStatus(request, event.target.value)}
              >
                {SUPPORT_REQUEST_STATUSES.map(({ code, label }) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </footer>
          </li>
        ))}
      </ul>
    </section>
  );
}
