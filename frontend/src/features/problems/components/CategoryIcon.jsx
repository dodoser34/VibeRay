import styles from './CategoryIcon.module.css';

const GLYPHS = {
  garbage: (
    <>
      <path d="M5 7h14M9 7V5h6v2M7 7l1 12h8l1-12" />
      <path d="M10 10v6M14 10v6" />
    </>
  ),
  traffic: (
    <>
      <path d="M5 16V11l2-4h10l2 4v5H5z" />
      <circle cx="8" cy="16.5" r="1.5" />
      <circle cx="16" cy="16.5" r="1.5" />
    </>
  ),
  roads: (
    <>
      <path d="M8 4L5 20M16 4l3 16M12 5v2M12 10v2" />
      <path d="M10.5 15l1.5 1.5 1.5-1 1 2" />
    </>
  ),
  lighting: (
    <>
      <path d="M8 21h8M12 21V9" />
      <path d="M8 9h8l-1.5-4h-5L8 9z" />
      <path d="M12 12v0" />
    </>
  ),
  noise: (
    <>
      <path d="M4 10v4h3l4 3V7L7 10H4z" />
      <path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11" />
    </>
  ),
  drunkenness: (
    <>
      <path d="M10 3h4v4l1.5 2.5V20h-7V9.5L10 7V3z" />
      <path d="M8.5 13h7" />
    </>
  ),
  public_transport: (
    <>
      <rect x="5" y="4" width="14" height="13" rx="2" />
      <path d="M5 11h14M8 20v-3M16 20v-3" />
    </>
  ),
  parks: (
    <>
      <path d="M12 20v-6" />
      <path d="M12 3c4 2 5 6 3 9H9C7 9 8 5 12 3z" />
    </>
  ),
  other: (
    <>
      <circle cx="6" cy="12" r="1.3" />
      <circle cx="12" cy="12" r="1.3" />
      <circle cx="18" cy="12" r="1.3" />
    </>
  ),
};

export function CategoryIcon({ category, size = 24 }) {
  return (
    <svg className={styles.root} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      {GLYPHS[category] ?? GLYPHS.other}
    </svg>
  );
}
