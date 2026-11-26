import { useTransitionNavigate } from '@/app/transitions/useTransition';
import { SupportCenter } from '@/features/support';
import { useLanguage } from '@/shared/hooks/useLanguage';

export function SupportPage() {
  useLanguage(); // при смене языка страница перерисовывается целиком
  const go = useTransitionNavigate();
  return <SupportCenter onNavigate={go} />;
}
