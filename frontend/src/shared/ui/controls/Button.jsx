import styles from './Button.module.css';

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  block = false,
  className = '',
  children,
  disabled,
  type = 'button',
  ...rest
}) {
  const classes = [styles.root, styles[variant], styles[size], block && styles.block, className]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-ui={variant === 'text' ? 'button-text' : size === 'sm' ? 'button-sm' : undefined}
      {...rest}
    >
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      <span className={styles.label}>{children}</span>
    </button>
  );
}
