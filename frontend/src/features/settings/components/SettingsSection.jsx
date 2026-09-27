import styles from './SettingsSection.module.css';

export function SettingsSection({ id, title, lead, children }) {
  return (
    <section
      id={id}
      className={styles.section}
      aria-labelledby={`${id}-title`}
      data-ui="settings-section"
      data-rise
    >
      <header className={styles.header}>
        <h2 id={`${id}-title`} className={styles.title}>
          {title}
        </h2>
        {lead && <p className={styles.lead}>{lead}</p>}
      </header>
      {children}
    </section>
  );
}
