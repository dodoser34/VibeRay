import { useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { usePageNavigate } from '@/app/transitions/useTransition';
import { useAuth } from '@/features/auth';
import { NotificationsPanel, useNotifications } from '@/features/notifications';
import { gsap, useGSAP } from '@/shared/animations/core/gsapSetup';
import { usePagePath } from '@/shared/hooks/usePagePath';
import { format } from '@/shared/lib/i18n/format';
import { localizePath } from '@/shared/lib/i18n/language';
import { isModerator } from '@/shared/config/roles';
import { Modal } from '@/shared/ui/windows/Modal';
import notificationTexts from '@/texts/en/notifications.json';
import nav from '@/texts/en/nav.json';
import { MobileMenu } from './MobileMenu';
import { useHideOnScroll } from './useHideOnScroll';
import styles from './MobileNav.module.css';
import { LogoMark } from '@/shared/ui/icons/LogoMark';

// Телефоны: вместо капсулы из пяти вкладок — две плавающие кнопки (логотип и меню), которые
// оставляют экран странице, и полноэкранное меню (MobileMenu) с крупными строками, аккаунтом и
// дашбордом города. Главное действие страницы остаётся на экране (карта, «Открыть карту»). Здесь —
// полоса кнопок, раскрытие меню кругом из кнопки и шторка уведомлений.
export function MobileNav() {
  const { user } = useAuth();
  const pathname = usePagePath();
  const openPage = usePageNavigate();
  const { unread, markRead } = useNotifications();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const menuId = useId();
  const barRef = useRef(null);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);
  const closingRef = useRef(null); // анимация сворачивания меню, если идёт
  // Меню относится к странице, на которой его открыли: любая смена маршрута его закрывает.
  const [openOn, setOpenOn] = useState(null);
  const open = openOn === pathname;
  const { hidden, scrolled } = useHideOnScroll(pathname, { paused: open });
  const home = isModerator(user) ? '/moderation' : '/';
  useGSAP(
    () => {
      // Конечные значения явно: повторный запуск (StrictMode) не примет недоигранный сдвиг за место
      // кнопок.
      gsap.fromTo(
        barRef.current.children,
        { y: -16, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.6, stagger: 0.08, ease: 'expo.out', delay: 0.2 },
      );
    },
    { scope: barRef },
  );

  // Центр кнопки меню: меню раскрывается из неё кругом и в неё же сворачивается.
  const menuCircle = (radius) => {
    const box = buttonRef.current.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const full = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );
    return `circle(${radius ?? full}px at ${x}px ${y}px)`;
  };

  useGSAP(() => {
    if (!open) return;
    gsap.fromTo(
      menuRef.current,
      { clipPath: menuCircle(buttonRef.current.offsetWidth / 2) },
      { clipPath: menuCircle(), duration: 0.55, ease: 'power3.inOut', clearProps: 'clipPath' },
    );
    gsap.from(menuRef.current.querySelectorAll('[data-menu-item]'), {
      y: 18,
      autoAlpha: 0,
      duration: 0.5,
      stagger: 0.045,
      ease: 'expo.out',
      delay: 0.12,
    });
  }, [open]);

  // Закрыть «на месте» (кнопка, Escape): меню сворачивается обратно в кнопку. Переход на другую
  // страницу закрывает его сразу — экран всё равно закроет переход. Повторное нажатие, пока меню
  // сворачивается, разворачивает его обратно с того же места, а не перезапускает анимацию.
  const closeMenu = () => {
    const menu = menuRef.current;
    if (!menu) return setOpenOn(null);
    if (closingRef.current) return closingRef.current;
    gsap.killTweensOf(menu);
    closingRef.current = gsap.fromTo(
      menu,
      { clipPath: menuCircle() },
      {
        clipPath: menuCircle(buttonRef.current.offsetWidth / 2),
        duration: 0.4,
        ease: 'power3.in',
        onComplete: () => {
          closingRef.current = null;
          setOpenOn(null);
        },
        onReverseComplete: () => {
          closingRef.current = null;
          gsap.set(menu, { clearProps: 'clipPath' });
        },
      },
    );
    return closingRef.current;
  };
  const toggleMenu = () => {
    if (closingRef.current) return closingRef.current.reverse();
    return open ? closeMenu() : setOpenOn(pathname);
  };
  const onEscape = useEffectEvent(closeMenu);

  // Пока меню открыто: страница под ним не прокручивается, Escape закрывает меню, фокус начинается
  // внутри.
  useEffect(() => {
    if (!open) return undefined;
    const button = buttonRef.current;
    document.body.style.overflow = 'hidden';
    menuRef.current.querySelector('a, button')?.focus();
    const onKey = (event) => event.key === 'Escape' && onEscape();
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
      <div
        className={styles.scrim}
        data-shown={(scrolled && !hidden) || undefined}
        aria-hidden="true"
      />
      <header
        ref={barRef}
        className={styles.bar}
        data-open={open || undefined}
        data-hidden={hidden || undefined}
      >
        <Link
          to={localizePath(home)}
          className={styles.logo}
          aria-label={nav.logoLabel}
          onClick={follow(home)}
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
          onClick={toggleMenu}
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
        <MobileMenu
          ref={menuRef}
          id={menuId}
          pathname={pathname}
          unread={unread}
          follow={follow}
          onClose={() => setOpenOn(null)}
          onOpenNotifications={() => setNotificationsOpen(true)}
        />
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
