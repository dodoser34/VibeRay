import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router';
import { useAuth } from '@/features/auth';
import { NotificationBell } from '@/features/notifications';
import { gsap, useGSAP } from '@/shared/animations/gsapSetup';
import { useLanguage } from '@/shared/hooks/useLanguage';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { format } from '@/shared/lib/format';
import { Avatar } from '@/shared/ui/Avatar';
import { LanguageSwitch } from '@/shared/ui/LanguageSwitch';
import { ThemeSwitch } from '@/shared/ui/ThemeSwitch';
import { usePageNavigate, useTransitionNavigate } from '../transitions/useTransition';
import nav from '@/texts/ru/nav.json';
import styles from './TabBar.module.css';

const DEFAULT_CITY = 'kostanay';

function activeKeyFor(pathname) {
  if (pathname.startsWith('/map')) return 'map';
  if (pathname === '/register') return 'register';
  if (pathname === '/about') return 'about';
  if (pathname === '/support') return 'support';
  if (pathname === '/settings') return 'me';
  return 'login';
}

export function TabBar() {
  const { user, logout } = useAuth();
  const language = useLanguage();
  const { pathname } = useLocation();
  const go = useTransitionNavigate();
  const openPage = usePageNavigate();
  const rootRef = useRef(null);
  const navRef = useRef(null);
  const trackRef = useRef(null);
  const pillRef = useRef(null);
  const introRef = useRef(true); // подсветка ждёт, пока кнопки долетят
  const reduced = useReducedMotion();
  const activeKey = activeKeyFor(pathname);
  // Актуальный путь для колбэков анимаций, которые завершаются уже после перехода.
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  const items = [
    ...(user
      ? [
          {
            key: 'me',
            label: user.nickname,
            avatar: user.avatar_url,
            to: '/settings',
            title: nav.tabs.settings.title,
            ariaLabel: format(nav.tabs.settings.label, { nickname: user.nickname }),
          },
          { key: 'logout', ...nav.tabs.logout, action: logout },
        ]
      : [
          { key: 'login', ...nav.tabs.login, to: '/login' },
          { key: 'register', ...nav.tabs.register, to: '/register' },
        ]),
    { key: 'map', ...nav.tabs.map, to: `/map/${DEFAULT_CITY}`, accent: true },
    { key: 'about', ...nav.tabs.about, to: '/about' },
    { key: 'support', ...nav.tabs.support, to: '/support' },
  ];

  const movePill = useCallback((key, duration) => {
    const active = trackRef.current.querySelector(`[data-key="${key}"]`);
    if (!active) {
      gsap.to(pillRef.current, { autoAlpha: 0, duration: 0.3 });
      return;
    }
    gsap.to(pillRef.current, {
      x: active.offsetLeft,
      width: active.offsetWidth,
      autoAlpha: 1,
      duration,
      ease: 'power3.out',
    });
  }, []);

  // Появление: капсула прилетает маленькой таблеткой и растягивается на всю ширину, центральная
  // кнопка выпрыгивает, затем из неё вылетают остальные — сначала ближняя пара, потом дальняя.
  useGSAP(
    () => {
      const nav = navRef.current;
      const buttons = [...trackRef.current.querySelectorAll('[data-key]')];
      const center = buttons.findIndex((button) => button.dataset.key === 'map');
      const finish = () => {
        introRef.current = false;
        movePill(activeKeyFor(pathRef.current), 0.45);
      };
      if (reduced) {
        gsap.from(rootRef.current, { autoAlpha: 0, duration: 0.3, onComplete: finish });
        return;
      }

      const side = (nav.offsetWidth - nav.offsetHeight) / 2;
      const collapsed = `inset(0px ${side}px 0px ${side}px round 999px)`;
      const centerX = buttons[center].offsetLeft + buttons[center].offsetWidth / 2;
      const offsetTo = (button) => centerX - (button.offsetLeft + button.offsetWidth / 2);
      const ring = (distance) => buttons.filter((_, i) => Math.abs(i - center) === distance);
      const shoot = (targets) => ({
        x: (i) => offsetTo(targets[i]),
        scale: 0.4,
        autoAlpha: 0,
      });

      gsap
        .timeline({
          delay: 0.15,
          onComplete: () => {
            gsap.set(nav, { clearProps: 'clipPath' });
            finish();
          },
        })
        .set(buttons, { autoAlpha: 0 })
        .fromTo(
          nav,
          {
            y: -110,
            autoAlpha: 0,
            clipPath: collapsed,
          },
          { y: 0, autoAlpha: 1, duration: 0.8, ease: 'expo.out' },
        )
        // Оба конца явно: браузер отдаёт clip-path в короткой форме, которую GSAP не может
        // сопоставить.
        .fromTo(
          nav,
          { clipPath: collapsed },
          {
            clipPath: 'inset(0px 0px 0px 0px round 999px)',
            duration: 0.75,
            ease: 'power3.inOut',
            immediateRender: false,
          },
          0.55,
        )
        .fromTo(
          buttons[center],
          { scale: 0.2, autoAlpha: 0 },
          { scale: 1, autoAlpha: 1, duration: 0.6, ease: 'back.out(2.2)' },
          1.05,
        )
        .fromTo(
          ring(1),
          shoot(ring(1)),
          { x: 0, scale: 1, autoAlpha: 1, duration: 0.7, ease: 'back.out(1.5)' },
          1.35,
        )
        .fromTo(
          ring(2),
          shoot(ring(2)),
          { x: 0, scale: 1, autoAlpha: 1, duration: 0.75, ease: 'back.out(1.3)' },
          1.5,
        )
        .from('[data-logo]', { x: -24, autoAlpha: 0, duration: 0.8, ease: 'expo.out' }, 1.3)
        .from('[data-aside]', { x: 24, autoAlpha: 0, duration: 0.8, ease: 'expo.out' }, 1.3);
    },
    { scope: rootRef },
  );

  // На другом языке вкладки другой ширины — подсветка переезжает под новую.
  useLayoutEffect(() => {
    if (!introRef.current) movePill(activeKey, 0.55);
  }, [activeKey, user, language, movePill]);

  // Подсветка сразу едет к нажатой вкладке, пока играет переход; если перехода не было (шёл
  // другой), она возвращается к текущей странице.
  const handleClick = (item) => (event) => {
    if (item.action) return item.action();
    event.preventDefault();
    if (pathname === item.to) return undefined;
    if (!introRef.current) movePill(item.key, 0.55);
    return Promise.resolve(go(item.to)).finally(() => {
      if (!introRef.current) movePill(activeKeyFor(pathRef.current), 0.55);
    });
  };

  return (
    <header ref={rootRef} className={styles.root}>
      <Link
        to="/"
        className={styles.logo}
        aria-label={nav.logoLabel}
        data-logo
        data-ui="tabbar-logo"
      >
        <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
          <rect width="32" height="32" rx="9" className={styles.logoBg} />
          <path d="M7 10l9 14 9-14" className={styles.logoMark} />
          <circle cx="16" cy="9" r="2.4" className={styles.logoDot} />
        </svg>
        <span data-ui="tabbar-brand">{nav.brand}</span>
      </Link>
      {/* На планшете стоя справа нет места — там тема встаёт рядом с логотипом (adaptations/tablet) */}
      <div className={styles.leadTheme} data-ui="tabbar-theme-lead">
        <ThemeSwitch />
      </div>

      <nav ref={navRef} className={styles.nav} aria-label={nav.navLabel}>
        <div ref={trackRef} className={styles.track}>
          <span ref={pillRef} className={styles.pill} aria-hidden="true" />
          {items.map((item) => {
            const content = (
              <>
                {item.avatar && <Avatar src={item.avatar} size={22} />}
                <span
                  className={styles.label}
                  data-ui={item.key === 'me' ? 'tabbar-nickname' : item.short && 'tabbar-label'}
                >
                  {item.label}
                </span>
                {item.short && (
                  <span className={styles.short} aria-hidden="true" data-ui="tabbar-short">
                    {item.short}
                  </span>
                )}
              </>
            );
            const className = `${styles.item} ${item.accent ? styles.accent : ''}`;
            return item.action ? (
              <button
                key={item.key}
                type="button"
                data-key={item.key}
                data-ui="tabbar-item"
                className={className}
                onClick={handleClick(item)}
              >
                {content}
              </button>
            ) : (
              <Link
                key={item.key}
                to={item.to}
                data-key={item.key}
                data-ui="tabbar-item"
                className={className}
                aria-current={activeKey === item.key ? 'page' : undefined}
                title={item.title}
                aria-label={item.ariaLabel}
                onClick={handleClick(item)}
              >
                {content}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className={styles.aside} data-ui="tabbar-aside" data-aside>
        <span className={styles.asideTheme} data-ui="tabbar-theme">
          <ThemeSwitch />
        </span>
        <LanguageSwitch />
        {user && <NotificationBell onNavigate={openPage} />}
      </div>
    </header>
  );
}
