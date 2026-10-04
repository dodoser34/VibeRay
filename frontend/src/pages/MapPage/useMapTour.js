import { useEffect, useState } from 'react';
import { readFlag, writeFlag } from '@/shared/lib/localFlag';
import texts from '@/texts/ru/map.json';

const TOUR_KEY = 'viberay:tour:map';
const TOUR_DELAY_MS = 3000; // после пролёта камеры и роста районов

// Подсказки при первом визите: открываются, когда карта показалась (ready), и больше не
// показываются после завершения. Шаги читают тексты при каждом рендере (язык меняется на лету).
export function useMapTour({ ready, homeDistrict, compact }) {
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    if (!ready || readFlag(TOUR_KEY)) return undefined;
    const timer = setTimeout(() => setTourOpen(true), TOUR_DELAY_MS);
    return () => clearTimeout(timer);
  }, [ready]);

  const finishTour = () => {
    writeFlag(TOUR_KEY);
    setTourOpen(false);
  };

  const tourSteps = [
    {
      target: `[data-ui="map-label"][data-slug="${homeDistrict ?? 'center'}"]`,
      padding: 26,
      round: true,
      ...texts.tour.district,
    },
    {
      target: '[data-onboarding="mood"], [data-onboarding="actions"]',
      round: true,
      title: texts.tour.mood.title,
      text: compact ? texts.tour.mood.textCompact : texts.tour.mood.text,
    },
    {
      target: '[data-onboarding="report"], [data-onboarding="actions"]',
      round: true,
      title: texts.tour.report.title,
      text: compact ? texts.tour.report.textCompact : texts.tour.report.text,
    },
  ];

  return { tourOpen, tourSteps, openTour: () => setTourOpen(true), finishTour };
}
