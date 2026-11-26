import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router';
import { useAuth } from '@/features/auth';
import { lastCity } from '@/features/map';
import { NotificationBell } from '@/features/notifications';
import { gsap, useGSAP } from '@/shared/animations/core/gsapSetup';
import { isModerator } from '@/shared/config/roles';
import { useLanguage } from '@/shared/hooks/useLanguage';
import { usePagePath } from '@/shared/hooks/usePagePath';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { format } from '@/shared/lib/i18n/format';
import { localizePath } from '@/shared/lib/i18n/language';
import { Avatar } from '@/shared/ui/avatar/Avatar';
import { LanguageSwitch } from '@/shared/ui/controls/LanguageSwitch';
import { ThemeSwitch } from '@/shared/ui/controls/ThemeSwitch';
import { LogoMark } from '@/shared/ui/icons/LogoMark';
import nav from '@/texts/en/nav.json';
import { usePageNavigate, useTransitionBusy } from '../transitions/useTransition';
import styles from './TabBar.module.css';

const MODERATION_PREFIX = '/moderation/';

function activeKeyFor(pathname) {
  if (pathname.startsWith('/map')) return 'map';
  if (pathname === '/register') return 'register';
  if (pathname === '/about') return 'about';
  if (pathname === '/support') return 'support';
  if (pathname === '/settings' || pathname === '/moderation/settings') return 'me';
  if (pathname === '/moderation') return 'moderation-queue';
  if (pathname.startsWith(MODERATION_PREFIX)) {
    return `moderation-${pathname.slice(MODERATION_PREFIX.length)}`;
  }
  return 'login';
}

export function TabBar() {
  const { user, logout } = useAuth();
  const language = useLanguage();
  const pathname = usePagePath();
  const openPage = usePageNavigate();
  const isBusy = useTransitionBusy();
  const rootRef = useRef(null);
  const navRef = useRef(null);
  const trackRef = useRef(null);
  const pillRef = useRef(null);
  const introRef = useRef(true); // подсветка ждёт, пока кнопки долетят
  const pendingRef = useRef(null); // вкладка, к которой идёт переход: подсветка уже стоит на ней
  const reduced = useReducedMotion();
  const activeKey = activeKeyFor(pathname);
  // Актуальный путь для колбэков анимаций, которые завершаются уже после перехода.
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  // У модератора свой набор вкладок — только его разделы; выход — рядом с профилем, как у жителя.
  const items = isModerator(user)
    ? [
        {
          key: 'me',
          label: user.nickname,
          avatar: user.avatar_url,
          to: '/moderation/settings',
          title: nav.moderator.settings,
          ariaLabel: nav.moderator.settings,
        },
        { key: 'logout', ...nav.tabs.logout, action: logout },
        ...['queue', 'map', 'city', 'support'].map((key) => ({
          key: `moderation-${key}`,
          ...nav.moderator.tabs[key],
          to: key === 'queue' ? '/moderation' : `/moderation/${key}`,
          accent: key === 'map',
        })),
      ]
    : [
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
        { key: 'map', ...nav.tabs.map, to: `/map/${lastCity()}`, accent: true },
        { key: 'about', ...nav.tabs.about, to: '/about' },
        { key: 'support', ...nav.tabs.support, to: '/support' },
      ];

  // overwrite: новая цель отменяет недоехавшую анимацию, иначе старая дотягивала бы подсветку
  // назад.
  const movePill = useCallback((key, duration) => {
    const active = trackRef.current.querySelector(`[data-key="${key}"]`);
    if (!active) {
      gsap.to(pillRef.current, { autoAlpha: 0, duration: 0.3, overwrite: true });
      return;
    }
    gsap.to(pillRef.current, {
      x: active.offsetLeft,
      width: active.offsetWidth,
      autoAlpha: 1,
      duration,
      ease: 'power3.out',
      overwrite: true,
    });
  }, []);

  // Появление: капсула прилетает маленькой таблеткой и растягивается на всю ширину, центральная
  // кнопка выпрыгивает, затем из неё вылетают остальные — сначала ближняя пара, потом дальняя.
  // Часть дальней кнопки, что ещё под ближним соседом, обрезается: подписи не наезжают друг на
  // друга, даже если вступление идёт рывками, пока грузится тяжёлая страница.
  useGSAP(
    () => {
      const navElement = navRef.current;
      const buttons = [...trackRef.current.querySelectorAll('[data-key]')];
      // Центр — акцентная кнопка карты (у жителя «map», у модератора «moderation-map»)
      const accent = buttons.findIndex((button) => button.dataset.accent !== undefined);
      const center = accent >= 0 ? accent : Math.floor(buttons.length / 2);
      const finish = () => {
        introRef.current = false;
        movePill(pendingRef.current ?? activeKeyFor(pathRef.current), 0.45);
      };
      if (reduced) {
        gsap.from(rootRef.current, { autoAlpha: 0, duration: 0.3, onComplete: finish });
        return;
      }

      const side = (navElement.offsetWidth - navElement.offsetHeight) / 2;
      const collapsed = `inset(0px ${side}px 0px ${side}px round 999px)`;
      const centerX = buttons[center].offsetLeft + buttons[center].offsetWidth / 2;
      const offsetTo = (button) => centerX - (button.offsetLeft + button.offsetWidth / 2);
      const ring = (distance) => buttons.filter((_, i) => Math.abs(i - center) === distance);
      const shoot = (targets) => ({
        x: (i) => offsetTo(targets[i]),
        scale: 0.4,
        autoAlpha: 0,
      });
      const rings = Math.max(center, buttons.length - 1 - center);

      // Края кнопки сейчас (с учётом сдвига и масштаба от её центра).
      const edges = (button) => {
        const scale = gsap.getProperty(button, 'scale');
        const middle = button.offsetLeft + button.offsetWidth / 2 + gsap.getProperty(button, 'x');
        const half = (button.offsetWidth * scale) / 2;
        return { left: middle - half, right: middle + half, scale };
      };
      // Дальняя кнопка видна только снаружи от соседней, ближней к центру.
      const outer = buttons
        .map((button, i) => ({
          button,
          direction: Math.sign(i - center),
          near: buttons[i - Math.sign(i - center)],
        }))
        .filter((_, i) => Math.abs(i - center) >= 2);
      const clipOuter = () =>
        outer.forEach(({ button, direction, near }) => {
          const own = edges(button);
          const neighbour = edges(near);
          const overlap = direction > 0 ? neighbour.right - own.left : own.right - neighbour.left;
          const hidden = Math.max(0, overlap) / own.scale;
          button.style.clipPath = !hidden
            ? ''
            : direction > 0
              ? `inset(0px 0px 0px ${hidden}px)`
              : `inset(0px ${hidden}px 0px 0px)`;
        });

      const timeline = gsap
        .timeline({
          delay: 0.15,
          onUpdate: clipOuter,
          onComplete: () => {
            gsap.set(navElement, { clearProps: 'clipPath' });
            gsap.set(buttons, { clearProps: 'zIndex,clipPath' });
            finish();
          },
        })
        .set(buttons, { autoAlpha: 0 })
        // Непрозрачная акцентная кнопка накрывает ближние, пока они под ней.
        .set(buttons[center], { zIndex: 1 })
        .fromTo(
          navElement,
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
          navElement,
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
        );
      // Вторая пара (у модератора есть и третья: шесть вкладок) — следом, с шагом 0.15 с.
      for (let distance = 2; distance <= rings; distance += 1) {
        timeline.fromTo(
          ring(distance),
          shoot(ring(distance)),
          { x: 0, scale: 1, autoAlpha: 1, duration: 0.75, ease: 'back.out(1.3)' },
          1.5 + (distance - 2) * 0.15,
        );
      }
      timeline
        .from('[data-logo]', { x: -24, autoAlpha: 0, duration: 0.8, ease: 'expo.out' }, 1.3)
        .from('[data-aside]', { x: 24, autoAlpha: 0, duration: 0.8, ease: 'expo.out' }, 1.3);
    },
    { scope: rootRef },
  );

  // На другом языке вкладки другой ширины — подсветка переезжает под новую. Во время перехода она
  // остаётся на вкладке, куда идёт переход.
  useLayoutEffect(() => {
    if (!introRef.current) movePill(pendingRef.current ?? activeKey, 0.55);
  }, [activeKey, user, language, movePill]);

  // Ширина вкладок меняется и без смены языка: окно перешло порог коротких подписей (планшет),
  // догрузился шрифт, сменился ник. Подсветка следует за своей вкладкой.
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      if (!introRef.current) movePill(pendingRef.current ?? activeKeyFor(pathRef.current), 0.3);
    });
    observer.observe(trackRef.current);
    return () => observer.disconnect();
  }, [movePill]);

  // Подсветка сразу едет к нажатой вкладке, пока играет переход. Клик во время чужого перехода
  // ничего не делает: переход всё равно его отклонит, а подсветка не должна метаться.
  const handleClick = (item) => (event) => {
    if (item.action) return item.action();
    event.preventDefault();
    if (pathname === item.to || isBusy()) return undefined;
    pendingRef.current = item.key;
    if (!introRef.current) movePill(item.key, 0.55);
    return Promise.resolve(openPage(item.to)).finally(() => {
      pendingRef.current = null;
      if (!introRef.current) movePill(activeKeyFor(pathRef.current), 0.55);
    });
  };

  return (
    <header ref={rootRef} className={styles.root}>
      <Link
        to={localizePath(isModerator(user) ? '/moderation' : '/')}
        className={styles.logo}
        aria-label={nav.logoLabel}
        data-logo
        data-ui="tabbar-logo"
      >
        <LogoMark framed />
        <span data-ui="tabbar-brand">{nav.brand}</span>
      </Link>
      {/* На планшете стоя справа нет места — тема встаёт рядом с логотипом (adaptations/tablet) */}
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
                data-accent={item.accent || undefined}
                data-ui="tabbar-item"
                className={className}
                onClick={handleClick(item)}
              >
                {content}
              </button>
            ) : (
              <Link
                key={item.key}
                to={localizePath(item.to)}
                data-key={item.key}
                data-accent={item.accent || undefined}
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
        {user && !isModerator(user) && <NotificationBell onNavigate={openPage} />}
      </div>
    </header>
  );
}
