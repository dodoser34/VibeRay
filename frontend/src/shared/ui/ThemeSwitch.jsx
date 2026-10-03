import { changeTheme } from '@/shared/animations/themeTransition';
import { useTheme } from '@/shared/hooks/useTheme';
import common from '@/texts/ru/common.json';
import { OptionGroup } from './OptionGroup';
import styles from './ThemeSwitch.module.css';

// Переключатель темы: солнце и луна. Компактный (шапка, меню телефона) — одна кнопка, которая
// показывает текущую тему и меняет её; full (настройки) — два варианта с названиями.
export function ThemeSwitch({ full = false }) {
  const theme = useTheme();
  if (full) {
    return (
      <OptionGroup
        label={common.theme.label}
        value={theme}
        onChange={changeTheme}
        options={['dark', 'light'].map((code) => ({
          code,
          label: common.theme.names[code],
          icon: <Icon theme={code} />,
        }))}
      />
    );
  }
  const next = theme === 'dark' ? 'light' : 'dark';
  const label = next === 'light' ? common.theme.toLight : common.theme.toDark;
  return (
    <button
      type="button"
      className={styles.toggle}
      aria-label={label}
      title={label}
      data-theme-icon={theme}
      data-ui="theme-switch"
      onClick={() => changeTheme(next)}
    >
      <Icon key={theme} theme={theme} />
    </button>
  );
}

function Icon({ theme }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className={styles.icon}>
      {theme === 'light' ? (
        <path d="M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
      ) : (
        <path d="M20 14.2A8.5 8.5 0 0 1 9.8 4a8.5 8.5 0 1 0 10.2 10.2z" />
      )}
    </svg>
  );
}
