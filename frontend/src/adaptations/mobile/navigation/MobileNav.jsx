import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useTransitionNavigate } from '@/app/transitions/useTransition';
import { useAuth } from '@/features/auth';
import { gsap, useGSAP } from '@/shared/animations/gsapSetup';
import { Avatar } from '@/shared/ui/Avatar';
import nav from '@/texts/nav.json';
import styles from './MobileNav.module.css';

const CITY = 'kostanay';

const ICONS = {
  map: <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14" />,
  stats: <path d="M4 20h16M7 16v-5M12 16V7M17 16v-8" />,
  about: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5v.5" />,
  support: <path d="M4 12a8 8 0 0 1 16 0v4a2 2 0 0 1-2 2h-1v-6h3M4 12v4a2 2 0 0 0 2 2h1v-6H4" />,
};

function activeKey(pathname) {
  if (pathname.endsWith('/stats')) return 'stats';
  if (pathname.startsWith('/map')) return 'map';
  if (pathname === '/about') return 'about';
  if (pathname === '/support') return 'support';
  return null;
}

// Телефоны: вместо капсулы из пяти вкладок — две плавающие кнопки (логотип и меню), которые
// оставляют экран странице, и полноэкранное меню с крупными строками, аккаунтом и дашбордом города.
// Главное действие страницы остаётся на экране (карта, «Открыть карту»).
export function MobileNav() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const go = useTransitionNavigate();
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

  // Внутри карты (карта ↔ дашборд) страница остаётся — без бумажного перехода.
  const follow = (to) => (event) => {
    event.preventDefault();
    setOpenOn(null);
    if (to === pathname) return;
    if (pathname.startsWith('/map') && to.startsWith('/map')) navigate(to);
    else go(to);
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
          aria-label={open ? nav.menu.close : nav.menu.open}
          onClick={() => setOpenOn(open ? null : pathname)}
        >
          <span className={styles.burger} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
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
    </>
  );
}
