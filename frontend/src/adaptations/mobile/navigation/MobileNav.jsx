import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { usePageNavigate } from '@/app/transitions/useTransition';
import { useAuth } from '@/features/auth';
import { NotificationsPanel, useNotifications } from '@/features/notifications';
import { gsap, useGSAP } from '@/shared/animations/gsapSetup';
import { usePagePath } from '@/shared/hooks/usePagePath';
import { format } from '@/shared/lib/format';
import { localizePath } from '@/shared/lib/language';
import { Avatar } from '@/shared/ui/Avatar';
import { LanguageSwitch } from '@/shared/ui/LanguageSwitch';
import { ThemeSwitch } from '@/shared/ui/ThemeSwitch';
import { Modal } from '@/shared/ui/Modal';
import notificationTexts from '@/texts/ru/notifications.json';
import nav from '@/texts/ru/nav.json';
import styles from './MobileNav.module.css';
import { LogoMark } from '@/shared/ui/icons/LogoMark';
import { Icon } from '@/shared/ui/icons/Icon';

const CITY = 'kostanay';

const ICONS = {
  map: 'map',
  stats: 'chart',
  about: 'info',
  support: 'headset',
  settings: 'sliders',
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
  const pathname = usePagePath();
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
        <Link
          to={localizePath('/')}
          className={styles.logo}
          aria-label={nav.logoLabel}
          onClick={follow('/')}
        >
          <LogoMark />
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
                  <Icon name="bell" size={20} />
                  <span>{notificationTexts.title}</span>
                  {unread > 0 && <span className={styles.count}>{unread}</span>}
                </button>
              </>
            ) : (
              <>
                <p className={styles.guestTitle}>{nav.menu.guestTitle}</p>
                <p className={styles.caption}>{nav.menu.guestText}</p>
                <div className={styles.authButtons}>
                  <Link
                    to={localizePath('/login')}
                    className={styles.primary}
                    onClick={follow('/login')}
                  >
                    {nav.tabs.login.label}
                  </Link>
                  <Link
                    to={localizePath('/register')}
                    className={styles.secondary}
                    onClick={follow('/register')}
                  >
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
                    to={localizePath(item.to)}
                    className={styles.item}
                    aria-current={current === item.key ? 'page' : undefined}
                    onClick={follow(item.to)}
                  >
                    <Icon name={ICONS[item.key]} className={styles.icon} />
                    <span>{item.label}</span>
                    <Icon name="chevron-right" className={styles.chevron} />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className={styles.footer} data-menu-item>
            <div className={styles.footerControls}>
              <ThemeSwitch />
              <LanguageSwitch />
            </div>
            <p>{nav.menu.footer}</p>
          </div>
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
