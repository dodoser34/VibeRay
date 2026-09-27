import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { usePageNavigate } from '@/app/transitions/useTransition';
import { useAuth } from '@/features/auth';
import { NotificationsPanel, useNotifications } from '@/features/notifications';
import { gsap, useGSAP } from '@/shared/animations/gsapSetup';
import { format } from '@/shared/lib/format';
import { Avatar } from '@/shared/ui/Avatar';
import { Modal } from '@/shared/ui/Modal';
import notificationTexts from '@/texts/notifications.json';
import nav from '@/texts/nav.json';
import styles from './MobileNav.module.css';

const CITY = 'kostanay';

const ICONS = {
  map: <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14" />,
  stats: <path d="M4 20h16M7 16v-5M12 16V7M17 16v-8" />,
  about: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5v.5" />,
  support: <path d="M4 12a8 8 0 0 1 16 0v4a2 2 0 0 1-2 2h-1v-6h3M4 12v4a2 2 0 0 0 2 2h1v-6H4" />,
  settings: <path d="M4 7h9M17 7h3M15 5v4M4 17h3M11 17h9M9 15v4" />,
};

function activeKey(pathname) {
  if (pathname.endsWith('/stats')) return 'stats';
  if (pathname.startsWith('/map')) return 'map';
  if (pathname === '/about') return 'about';
  if (pathname === '/support') return 'support';
  if (pathname === '/settings') return 'settings';
  return null;
}

// Телефоны: вместо капсулы из пяти вкладок — две плавающие кнопки (логотип и меню), которые
// оставляют экран странице, и полноэкранное меню с крупными строками, аккаунтом и дашбордом города.
// Главное действие страницы остаётся на экране (карта, «Открыть карту»).
export function MobileNav() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const openPage = usePageNavigate();
  const { unread, markRead } = useNotifications();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const menuId = useId();
  const barRef = useRef(null);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);
  // Меню относится к странице, на которой его открыли: любая смена маршрута его закрывает.
  const [openOn, setOpenOn] = useState(null);
  const open = openOn === pathname;
  const current = activeKey(pathname);

  const items = [
    { key: 'map', to: `/map/${CITY}`, label: nav.tabs.map.label },
    { key: 'stats', to: `/map/${CITY}/stats`, label: nav.menu.stats },
    { key: 'about', to: '/about', label: nav.tabs.about.label },
    { key: 'support', to: '/support', label: nav.tabs.support.label },
    ...(user ? [{ key: 'settings', to: '/settings', label: nav.menu.settings }] : []),
  ];

  useGSAP(
    () => {
      gsap.from(barRef.current.children, {
        y: -16,
        autoAlpha: 0,
        duration: 0.6,
        stagger: 0.08,
        ease: 'expo.out',
        delay: 0.2,
      });
    },
    { scope: barRef },
  );

  useGSAP(() => {
    if (!open) return;
    gsap.from(menuRef.current, { autoAlpha: 0, duration: 0.25 });
    gsap.from(menuRef.current.querySelectorAll('[data-menu-item]'), {
      y: 18,
      autoAlpha: 0,
      duration: 0.5,
      stagger: 0.045,
      ease: 'expo.out',
    });
  }, [open]);

  // Пока меню открыто: страница под ним не прокручивается, Escape закрывает меню, фокус начинается
  // внутри.
  useEffect(() => {
    if (!open) return undefined;
    const button = buttonRef.current;
    document.body.style.overflow = 'hidden';
    menuRef.current.querySelector('a, button')?.focus();
    const onKey = (event) => event.key === 'Escape' && setOpenOn(null);
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      button?.focus();
    };
  }, [open]);

  const follow = (to) => (event) => {
    event.preventDefault();
    setOpenOn(null);
    if (to !== pathname) openPage(to);
  };

  // Увиденное в шторке отмечается прочитанным, когда её закрывают.
  const closeNotifications = () => {
    setNotificationsOpen(false);
    if (unread) markRead();
  };

  return (
    <>
      <header ref={barRef} className={styles.bar} data-open={open || undefined}>
        <Link to="/" className={styles.logo} aria-label={nav.logoLabel} onClick={follow('/')}>
          <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
            <rect width="32" height="32" rx="9" className={styles.logoBg} />
            <path d="M7 10l9 14 9-14" className={styles.logoMark} />
            <circle cx="16" cy="9" r="2.4" className={styles.logoDot} />
          </svg>
        </Link>
        <button
          ref={buttonRef}
          type="button"
          className={styles.menuButton}
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={
            open
              ? nav.menu.close
              : unread
                ? format(nav.menu.openUnread, { count: unread })
                : nav.menu.open
          }
          onClick={() => setOpenOn(open ? null : pathname)}
        >
          <span className={styles.burger} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          {unread > 0 && !open && <span className={styles.badge} aria-hidden="true" />}
        </button>
      </header>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          className={styles.menu}
          role="dialog"
          aria-modal="true"
          aria-label={nav.menu.title}
        >
          <div className={styles.account} data-menu-item>
            {user ? (
              <>
                <Avatar src={user.avatar_url} size={48} />
                <div className={styles.who}>
                  <span className={styles.caption}>{nav.menu.signedIn}</span>
                  <span className={styles.nickname}>{user.nickname}</span>
                </div>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => {
                    setOpenOn(null);
                    logout();
                  }}
                >
                  {nav.tabs.logout.label}
                </button>
                <button
                  type="button"
                  className={styles.notifications}
                  onClick={() => {
                    setOpenOn(null);
                    setNotificationsOpen(true);
                  }}
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                    <path d="M12 21a2.5 2.5 0 0 0 2.5-2.5h-5A2.5 2.5 0 0 0 12 21zM5 16.5h14l-1.8-2.4V10a5.2 5.2 0 0 0-10.4 0v4.1z" />
                  </svg>
                  <span>{notificationTexts.title}</span>
                  {unread > 0 && <span className={styles.count}>{unread}</span>}
                </button>
              </>
            ) : (
              <>
                <p className={styles.guestTitle}>{nav.menu.guestTitle}</p>
                <p className={styles.caption}>{nav.menu.guestText}</p>
                <div className={styles.authButtons}>
                  <Link to="/login" className={styles.primary} onClick={follow('/login')}>
                    {nav.tabs.login.label}
                  </Link>
                  <Link to="/register" className={styles.secondary} onClick={follow('/register')}>
                    {nav.tabs.register.label}
                  </Link>
                </div>
              </>
            )}
          </div>

          <nav aria-label={nav.navLabel}>
            <ul className={styles.list}>
              {items.map((item) => (
                <li key={item.key} data-menu-item>
                  <Link
                    to={item.to}
                    className={styles.item}
                    aria-current={current === item.key ? 'page' : undefined}
                    onClick={follow(item.to)}
                  >
                    <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true">
                      {ICONS[item.key]}
                    </svg>
                    <span>{item.label}</span>
                    <svg viewBox="0 0 16 16" className={styles.chevron} aria-hidden="true">
                      <path d="M6 3l5 5-5 5" />
                    </svg>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <p className={styles.footer} data-menu-item>
            {nav.menu.footer}
          </p>
        </div>
      )}
      {notificationsOpen && (
        <Modal title={notificationTexts.title} onClose={closeNotifications}>
          <div className={styles.sheetList}>
            <NotificationsPanel compact onNavigate={openPage} onDone={closeNotifications} />
          </div>
        </Modal>
      )}
    </>
  );
}
