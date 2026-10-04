import { useLocation } from 'react-router';
import { stripLanguage } from '@/shared/lib/language';

// Путь страницы без префикса языка и без косой черты в конце: на /en/about/ — '/about'. Им
// сравнивают «где мы» (активная вкладка, нужен ли переход), чтобы не учитывать язык и вид адреса
// (статический хостинг открывает страницы как /about/) в каждом сравнении.
export function usePagePath() {
  const path = stripLanguage(useLocation().pathname);
  return path.length > 1 ? path.replace(/\/$/, '') : path;
}
