import { useTransitionNavigate } from '@/app/transitions/useTransition';
import { SupportCenter } from '@/features/support';

export function SupportPage() {
  const go = useTransitionNavigate();
  return <SupportCenter onNavigate={go} />;
}
