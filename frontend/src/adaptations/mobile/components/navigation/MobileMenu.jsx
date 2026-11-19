import { Link } from 'react-router';
import { useAuth } from '@/features/auth';
import { lastCity } from '@/features/map';
import { isModerator } from '@/shared/config/roles';
import { localizePath } from '@/shared/lib/i18n/language';
import { Avatar } from '@/shared/ui/avatar/Avatar';
import { LanguageSwitch } from '@/shared/ui/controls/LanguageSwitch';
import { ThemeSwitch } from '@/shared/ui/controls/ThemeSwitch';
import { Icon } from '@/shared/ui/icons/Icon';
import nav from '@/texts/en/nav.json';
import notificationTexts from '@/texts/en/notifications.json';
import styles from './MobileMenu.module.css';

const ICONS = {
  map: 'map',
  stats: 'chart',
  about: 'info',
  support: 'headset',
  settings: 'sliders',
  'moderation-queue': 'shield',
  'moderation-map': 'map',
  'moderation-city': 'chart',
  'moderation-support': 'headset',
  'moderation-settings': 'sliders',
};

function activeKey(pathname) {
  if (pathname.endsWith('/stats')) return 'stats';
  if (pathname.startsWith('/map')) return 'map';
  if (pathname === '/about') return 'about';
  if (pathname === '/support') return 'support';
  if (pathname === '/settings') return 'settings';
  if (pathname === '/moderation') return 'moderation-queue';
  if (pathname.startsWith('/moderation/')) return `moderation-${pathname.slice(12)}`;
  return null;
}

// Полноэкранное меню телефона: аккаунт (или вход для гостя), крупные строки разделов, тема и язык.
// Раскрытие кругом из кнопки и его анимация — в MobileNav (ref). follow(to) — обработчик ссылки,
// который закрывает меню и открывает страницу.
export function MobileMenu({ ref, id, pathname, unread, follow, onClose, onOpenNotifications }) {
  const { user, logout } = useAuth();
  const moderator = isModerator(user);
  const current = activeKey(pathname);
  // У модератора в меню только его разделы (страницы жителей ему не открываются).
  const items = moderator
    ? [
        ...['queue', 'map', 'city', 'support'].map((key) => ({
          key: `moderation-${key}`,
          to: key === 'queue' ? '/moderation' : `/moderation/${key}`,
          label: nav.moderator.tabs[key].label,
        })),
        { key: 'moderation-settings', to: '/moderation/settings', label: nav.moderator.settings },
      ]
    : [
        { key: 'map', to: `/map/${lastCity()}`, label: nav.tabs.map.label },
        { key: 'stats', to: `/map/${lastCity()}/stats`, label: nav.menu.stats },
        { key: 'about', to: '/about', label: nav.tabs.about.label },
        { key: 'support', to: '/support', label: nav.tabs.support.label },
        ...(user ? [{ key: 'settings', to: '/settings', label: nav.menu.settings }] : []),
      ];

  return (
    <div
      ref={ref}
      id={id}
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
                onClose();
                logout();
              }}
            >
              {nav.tabs.logout.label}
            </button>
            {!moderator && (
              <button
                type="button"
                className={styles.notifications}
                onClick={() => {
                  onClose();
                  onOpenNotifications();
                }}
              >
                <Icon name="bell" size={20} />
                <span>{notificationTexts.title}</span>
                {unread > 0 && <span className={styles.count}>{unread}</span>}
              </button>
            )}
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
  );
}
