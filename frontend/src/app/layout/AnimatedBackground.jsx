import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { SiteBackground } from '@/shared/animations/SiteBackground';
import { subscribeTheme } from '@/shared/lib/theme';
import styles from './AnimatedBackground.module.css';

// Кнопки и панели сохраняют свои клики; клик в любом другом месте пускает волну по изолиниям.
const INTERACTIVE = 'a, button, input, textarea, select, label, [role="button"], [role="radio"]';

export function AnimatedBackground() {
  const canvasRef = useRef(null);
  const backgroundRef = useRef(null);
  // Полноэкранная карта полностью закрывает фон — анимировать его там незачем.
  const active = !useLocation().pathname.startsWith('/map');

  useEffect(() => {
    const background = new SiteBackground(canvasRef.current);
    backgroundRef.current = background;
    const onPointerDown = (event) => {
      if (!event.target.closest(INTERACTIVE)) background.ripple(event.clientX, event.clientY);
    };
    window.addEventListener('pointerdown', onPointerDown);
    const unsubscribe = subscribeTheme(() => background.refreshTheme());
    return () => {
      unsubscribe();
      window.removeEventListener('pointerdown', onPointerDown);
      background.dispose();
      backgroundRef.current = null;
    };
  }, []);

  useEffect(() => {
    const background = backgroundRef.current;
    if (active) background.start();
    else background.stop();
  }, [active]);

  return <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />;
}
