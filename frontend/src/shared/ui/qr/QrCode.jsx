import { useMemo } from 'react';
import QRCode from 'qrcode';
import styles from './QrCode.module.css';

const QUIET = 3; // модулей светлого поля вокруг кода: без него камера не находит края

// QR-код как SVG: тёмные модули на светлом поле в обеих темах (инвертированный код читают не все
// камеры). Модули — один path, размер задаёт CSS.
export function QrCode({ value, label, className }) {
  const { size, path } = useMemo(() => {
    const { modules } = QRCode.create(value, { errorCorrectionLevel: 'M' });
    let d = '';
    for (let y = 0; y < modules.size; y++) {
      for (let x = 0; x < modules.size; x++) {
        if (modules.get(y, x)) d += `M${x + QUIET} ${y + QUIET}h1v1h-1z`;
      }
    }
    return { size: modules.size + QUIET * 2, path: d };
  }, [value]);

  return (
    <svg
      className={[styles.code, className].filter(Boolean).join(' ')}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={label}
    >
      <rect className={styles.field} width={size} height={size} />
      <path className={styles.modules} d={path} />
    </svg>
  );
}
