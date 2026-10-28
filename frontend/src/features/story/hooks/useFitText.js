import { useLayoutEffect } from 'react';
import { useLanguage } from '@/shared/hooks/useLanguage';

// Подписи в SVG-рисунке не шире места на любом языке: у <text data-fit="ширина"> шрифт уменьшается
// под ширину. data-fit-text — текст, по которому мерить (для строки, которая печатается по буквам).
// Меряем после загрузки шрифта и заново при смене языка.
export function useFitText(rootRef) {
  const language = useLanguage();
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    let alive = true;
    const fit = () => {
      if (!alive) return;
      root.querySelectorAll('text[data-fit]').forEach((node) => {
        node.style.fontSize = '';
        let width;
        if (node.dataset.fitText) {
          const probe = node.cloneNode(false);
          probe.textContent = node.dataset.fitText;
          node.parentNode.appendChild(probe);
          width = probe.getComputedTextLength();
          probe.remove();
        } else {
          width = node.getComputedTextLength();
        }
        const limit = Number(node.dataset.fit);
        if (width > limit) {
          const size = parseFloat(getComputedStyle(node).fontSize);
          node.style.fontSize = `${(size * limit) / width}px`;
        }
      });
    };
    fit();
    document.fonts?.ready.then(fit);
    return () => {
      alive = false;
    };
  }, [rootRef, language]);
}
