import styles from './CategoryIcon.module.css';
import { Icon } from '@/shared/ui/Icon';

// Код категории → иконка из реестра (shared/ui/icons).
const GLYPHS = {
  garbage: 'trash',
  traffic: 'car',
  roads: 'road',
  lighting: 'streetlight',
  noise: 'speaker',
  drunkenness: 'bottle',
  public_transport: 'bus',
  parks: 'tree',
  other: 'dots',
};

export function CategoryIcon({ category, size = 24 }) {
  return <Icon name={GLYPHS[category] ?? GLYPHS.other} size={size} className={styles.root} />;
}
