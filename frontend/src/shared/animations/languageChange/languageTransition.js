import { prefersReducedMotion } from '@/shared/hooks/useReducedMotion';
import {
  applyLanguage,
  getLanguage,
  loadLanguage,
  settleLanguageWork,
} from '@/shared/lib/language';
import { gsap } from '../gsapSetup';

const MARK = 'data-language-text';
const SKIP = 'script, style, noscript, canvas, textarea, [data-language-static]';
const BLUR = '8px';
const WAIT_FOR_DATA_MS = 1200;

let running = false;

// Метка на самых внешних элементах с собственным текстом: размытие наследуется потомками, поэтому
// вложенные метки снимаются — иначе текст размывался бы дважды.
function markText() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.nodeValue.trim() && !node.parentElement.closest(SKIP)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT,
  });
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const element = node.parentElement;
    if (element.closest(`[${MARK}]`)) continue;
    element.querySelectorAll(`[${MARK}]`).forEach((inner) => inner.removeAttribute(MARK));
    element.setAttribute(MARK, '');
  }
}

function unmarkText() {
  document.querySelectorAll(`[${MARK}]`).forEach((element) => element.removeAttribute(MARK));
}

const nextTask = () => new Promise((resolve) => setTimeout(resolve));

// Смена языка без перезагрузки: весь текст плавно размывается, меняется на новый язык (вместе с
// названиями районов, которые сервер отдаёт заново) и проявляется. Карта, прокрутка и введённые данные
// остаются как были.
export async function changeLanguage(next) {
  if (running || next === getLanguage()) return;
  running = true;
  const root = document.documentElement;
  try {
    // Перевод скачивается, пока текст размывается.
    const loaded = loadLanguage(next);
    if (prefersReducedMotion()) {
      await applyLanguage(next);
      return;
    }
    markText();
    await gsap.fromTo(
      root,
      { '--language-blur': '0px' },
      { '--language-blur': BLUR, duration: 0.28, ease: 'power2.in' },
    );
    await loaded;
    await applyLanguage(next);
    await nextTask();
    await settleLanguageWork(WAIT_FOR_DATA_MS);
    unmarkText();
    markText();
    await gsap.to(root, { '--language-blur': '0px', duration: 0.55, ease: 'power2.out' });
  } catch (error) {
    // Перевод не скачался (нет сети) — страница остаётся на прежнем языке.
    console.error('Language switch failed', error);
  } finally {
    unmarkText();
    root.style.removeProperty('--language-blur');
    running = false;
  }
}
