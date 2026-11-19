import { changeTheme } from '@/shared/animations/themeChange/themeTransition';
import { useTheme } from '@/shared/hooks/useTheme';
import common from '@/texts/en/common.json';
import { Icon } from '../icons/Icon';
import { OptionGroup } from './OptionGroup';
import styles from './ThemeSwitch.module.css';

const THEME_ICON = { light: 'sun', dark: 'moon' };

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
          icon: <Icon name={THEME_ICON[code]} size={18} className={styles.icon} />,
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
      <Icon key={theme} name={THEME_ICON[theme]} size={18} className={styles.icon} />
    </button>
  );
}
