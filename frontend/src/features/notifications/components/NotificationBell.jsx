import { useEffect, useId, useRef, useState } from 'react';
import { gsap, useGSAP } from '@/shared/animations/gsapSetup';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { format } from '@/shared/lib/format';
import { useNotifications } from '../model/useNotifications';
import { NotificationsPanel } from './NotificationsPanel';
import texts from '@/texts/ru/notifications.json';
import styles from './NotificationBell.module.css';
import { Icon } from '@/shared/ui/Icon';

// Колокольчик в шапке (планшет и десктоп). Новое уведомление — колокольчик качнётся, счётчик
// подпрыгнет. Панель раскрывается под кнопкой; при закрытии увиденное отмечается прочитанным.
export function NotificationBell({ onNavigate }) {
  const { unread, markRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const iconRef = useRef(null);
  const seenRef = useRef(unread);
  const reduced = useReducedMotion();
  const headingId = useId();

  const close = ({ restoreFocus = true } = {}) => {
    setOpen(false);
    if (unread) markRead();
    if (restoreFocus) buttonRef.current?.focus();
  };

  useGSAP(
    () => {
      const grew = unread > seenRef.current;
      seenRef.current = unread;
      if (!grew || reduced) return;
      gsap.fromTo(
        iconRef.current,
        { rotation: 0 },
        {
          keyframes: { rotation: [0, 16, -13, 9, -5, 0] },
          duration: 0.9,
          ease: 'power1.inOut',
          transformOrigin: '50% 10%',
        },
      );
      gsap.from('[data-badge]', { scale: 0.4, duration: 0.5, ease: 'back.out(2.5)' });
    },
    { scope: rootRef, dependencies: [unread] },
  );

  useGSAP(
    () => {
      if (!open || reduced) return;
      gsap.from(panelRef.current, {
        y: -10,
        scale: 0.97,
        autoAlpha: 0,
        duration: 0.35,
        ease: 'power3.out',
        transformOrigin: '100% 0%',
      });
    },
    { scope: rootRef, dependencies: [open] },
  );

  useEffect(() => {
    if (open) panelRef.current.querySelector('button')?.focus();
  }, [open]);

  // Без зависимостей: слушатели всегда видят свежий close (с текущим числом непрочитанных).
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) =>
      !rootRef.current.contains(event.target) && close({ restoreFocus: false });
    const onKey = (event) => event.key === 'Escape' && close();
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  });

  return (
    <div ref={rootRef} className={styles.root} data-ui="notification-bell">
      <button
        ref={buttonRef}
        type="button"
        className={styles.button}
        aria-label={unread ? format(texts.bellUnread, { count: unread }) : texts.bell}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-open={open || undefined}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <Icon name="bell" size={20} ref={iconRef} />
        {unread > 0 && (
          <span className={styles.badge} data-badge aria-hidden="true">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className={styles.popover}
          role="dialog"
          aria-labelledby={headingId}
          data-ui="notification-popover"
        >
          <NotificationsPanel
            headingId={headingId}
            onNavigate={onNavigate}
            onDone={() => close({ restoreFocus: false })}
          />
        </div>
      )}
    </div>
  );
}
