import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { changeLanguage } from '@/shared/animations/languageTransition';
import { useLanguage } from '@/shared/hooks/useLanguage';
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  languageOfPath,
  localizePath,
  stripLanguage,
} from '@/shared/lib/language';

// Адрес → абсолютная ссылка с подпапкой сайта, в том же виде, что у страниц сборки (/en/about/ —
// plugins/languagePages.js).
const absolute = (path) =>
  new URL(
    import.meta.env.BASE_URL.replace(/\/$/, '') + path.replace(/\/?$/, '/'),
    window.location.origin,
  ).href;

// Ссылки на ту же страницу на других языках: поисковики показывают человеку версию на его языке и
// не считают переводы копиями. x-default — основная, русская.
function updateAlternates(page) {
  document.head.querySelectorAll('link[data-language-link]').forEach((link) => link.remove());
  const links = [
    ...LANGUAGES.map((code) => ['alternate', code, localizePath(page, code)]),
    ['alternate', 'x-default', localizePath(page, DEFAULT_LANGUAGE)],
    ['canonical', null, localizePath(page)],
  ];
  links.forEach(([rel, hreflang, path]) => {
    const link = document.createElement('link');
    link.rel = rel;
    if (hreflang) link.hreflang = hreflang;
    link.href = absolute(path);
    link.dataset.languageLink = '';
    document.head.append(link);
  });
}

// Язык и адрес согласованы в обе стороны. Сменили язык переключателем — адрес меняется на ту же
// страницу с другим префиксом (replace: смена языка — не переход). Сменился адрес (назад/вперёд,
// ссылка на другую версию) — меняется язык.
export function useLanguageRoute() {
  const language = useLanguage();
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  const urlLanguage = languageOfPath(pathname);
  const page = stripLanguage(pathname);
  const shownLanguage = useRef(language);

  useEffect(() => {
    if (language !== shownLanguage.current) {
      shownLanguage.current = language;
      if (urlLanguage !== language) {
        navigate(localizePath(page, language) + search + hash, { replace: true });
      }
    } else if (urlLanguage !== language) {
      changeLanguage(urlLanguage);
    }
  }, [language, urlLanguage, page, search, hash, navigate]);

  useEffect(() => {
    if (urlLanguage === language) updateAlternates(page);
  }, [language, urlLanguage, page]);
}
