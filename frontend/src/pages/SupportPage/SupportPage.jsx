import { useTransitionNavigate } from '@/app/transitions/useTransition';
import { SupportCenter } from '@/features/support';
import { useLanguage } from '@/shared/hooks/useLanguage';

export function SupportPage() {
  // Страница — корень своей ветки: при смене языка перерисовывается вместе со всем содержимым.
  useLanguage();
  const go = useTransitionNavigate();
  return <SupportCenter onNavigate={go} />;
}
