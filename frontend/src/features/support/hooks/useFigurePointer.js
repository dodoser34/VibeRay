import { useEffect, useRef } from 'react';
import { gsap, useGSAP } from '@/shared/animations/gsapSetup';

// Где кончик пальца на картинке faq-assistant.webp — доля её высоты.
const FINGER = 0.278;

// Девушка у частых вопросов подъезжает к открытому вопросу и показывает пальцем на его строку;
// вопрос закрыли — возвращается на место. Пока список прокручивается, догоняет вопрос. Двигается,
// только когда стоит рядом со списком («липкая»): на телефоне она у заголовка и закрыла бы ответы.
export function useFigurePointer(figureRef, areaRef, openId, reduced) {
  const openRef = useRef(openId);
  const updateRef = useRef(null);

  useGSAP(
    () => {
      const figure = figureRef.current;
      const area = areaRef.current;
      if (!figure || !area) return undefined;
      const moveY = gsap.quickTo(figure, 'y', { duration: reduced ? 0 : 0.8, ease: 'power3.out' });

      const update = () => {
        const id = openRef.current;
        const row = id && document.querySelector(`#q-${id} [data-ui='faq-question']`);
        if (!row || getComputedStyle(figure).position !== 'sticky') {
          moveY(0);
          return;
        }
        const rect = figure.getBoundingClientRect();
        const top = rect.top - gsap.getProperty(figure, 'y');
        const target = row.getBoundingClientRect();
        const bounds = area.getBoundingClientRect();
        const y = target.top + target.height / 2 - (top + rect.height * FINGER);
        // Не выходит за границы списка: сверху — заголовок, снизу — следующие разделы страницы
        const min = bounds.top - top;
        const max = Math.max(min, bounds.bottom - (top + rect.height));
        moveY(gsap.utils.clamp(min, max, y));
      };

      updateRef.current = update;
      update();
      window.addEventListener('scroll', update, { passive: true });
      window.addEventListener('resize', update);
      return () => {
        updateRef.current = null;
        window.removeEventListener('scroll', update);
        window.removeEventListener('resize', update);
      };
    },
    { dependencies: [reduced], revertOnUpdate: true },
  );

  useEffect(() => {
    openRef.current = openId;
    updateRef.current?.();
  }, [openId]);
}
