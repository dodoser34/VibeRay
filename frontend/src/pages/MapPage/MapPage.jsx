import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useTransitionNavigate, useTransitionReady } from '@/app/transitions/useTransition';
import { rootScale, useViewport } from '@/adaptations/core';
import { FilterChip } from '@/adaptations/mobile/map/FilterChip';
import { MapFab } from '@/adaptations/mobile/map/MapFab';
import { BottomSheet } from '@/adaptations/mobile/sheet/BottomSheet';
import { useAuth } from '@/features/auth';
import { MapCanvas, useCityData } from '@/features/map';
import { DistrictRanking, MoodFace, MoodPicker } from '@/features/mood';
import { ProblemCard, ReportProblem } from '@/features/problems';
import {
  CityDashboard,
  DistrictPanel,
  mapOverlay,
  reportedRange,
  statsMoods,
  useCityStats,
  useDistrictStats,
} from '@/features/stats';
import { postMood } from '@/shared/api/endpoints/districts';
import { gsap, useGSAP } from '@/shared/animations/gsapSetup';
import { moodCodeForScore, MOOD_BY_CODE } from '@/shared/config/moods';
import { DEFAULT_STATS_PERIOD, MOOD_PERIODS, STATS_PERIODS } from '@/shared/config/periods';
import { CATEGORY_BY_CODE } from '@/shared/config/problemCategories';
import { usePageEntered } from '@/shared/hooks/usePageEntered';
import { multiPolygonAreaKm2 } from '@/shared/lib/geoProjection';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { format } from '@/shared/lib/format';
import texts from '@/texts/map.json';
import { MapFilters } from './MapFilters';
import styles from './MapPage.module.css';

const TOAST_MS = 3200;

// Где открывается шторка для каждого содержимого (телефоны, планшеты стоя). Пока ставится новая
// проблема, шторка опускается низко, чтобы карта была свободна для пальца.
const SHEET_SNAP = {
  overview: 'peek',
  district: 'half',
  problem: 'half',
  stats: 'half',
  'report:category': 'half',
  'report:place': 'peek',
  'report:details': 'full',
};

function StatsIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" className={styles.icon}>
      <path d="M2.5 13.5h11M4.5 11V7.5M8 11V4M11.5 11V6" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" className={styles.icon}>
      <path d="M9.5 3.5 5 8l4.5 4.5" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" className={styles.icon}>
      <path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
    </svg>
  );
}

// Одна страница, два вида одной 3D-карты (карта никогда не монтируется заново): вид «map»
// (/map/:city, /map/:city/district/:slug) — живое настроение, проблемы, панель района; вид «stats»
// (/map/:city/stats?period=) — дашборд города за месяц, год или все годы, нарисованный на районах.
// Две раскладки (src/adaptations): боковые панели на десктопах и планшетах в альбомной ориентации;
// на телефонах и планшетах стоя карта занимает экран — фильтры сворачиваются в чип, действия — в
// кнопку «+», каждая панель открывается в шторке.
export function MapPage({ view = 'map' }) {
  const { citySlug, districtSlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const go = useTransitionNavigate();
  const { user } = useAuth();
  const { compact: sheetLayout, isMobile } = useViewport();
  const isStats = view === 'stats';
  const [period, setPeriod] = useState('day');
  const [layer, setLayer] = useState('districts');
  const [metric, setMetric] = useState('mood');
  const [focus, setFocus] = useState(null); // район, подсвеченный на дашборде
  const [hover, setHover] = useState(null);
  const [problem, setProblem] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [report, setReport] = useState(false);
  const [reportStep, setReportStep] = useState('category');
  const [placement, setPlacement] = useState(null); // { district, location }, выбранные на карте
  const [authReason, setAuthReason] = useState(null);
  const [toast, setToast] = useState(null);
  // Положение шторки, выбранное пользователем, запоминается для того содержимого, при котором его
  // выбрали.
  const [sheetChoice, setSheetChoice] = useState({ key: null, snap: null });

  const requestedPeriod = searchParams.get('period');
  const statsPeriod = STATS_PERIODS.some((p) => p.code === requestedPeriod)
    ? requestedPeriod
    : DEFAULT_STATS_PERIOD;

  const { city, moods, problems } = useCityData(citySlug, period);
  // Переход страницы ждёт город и его настроения, прежде чем сложиться.
  useTransitionReady(Boolean(city.data && moods.data));
  const entered = usePageEntered();
  const stats = useDistrictStats(isStats ? null : districtSlug, period);
  const cityStats = useCityStats(isStats ? citySlug : null, statsPeriod);

  const pageRef = useRef(null);
  const mapRef = useRef(null);
  const tooltipRef = useRef(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const fadeRef = useRef(null);
  const viewRef = useRef(view);

  const districts = useMemo(
    () =>
      city.data?.districts.features.map((f) => ({
        slug: f.properties.slug,
        name: f.properties.name,
        palette: f.properties.palette,
      })) ?? [],
    [city.data],
  );
  const names = useMemo(
    () => Object.fromEntries(districts.map((d) => [d.slug, d.name])),
    [districts],
  );
  const nameOf = (slug) => names[slug] ?? '';
  const district =
    !isStats && districtSlug ? { slug: districtSlug, name: nameOf(districtSlug) } : null;

  const overlay = useMemo(
    () => (isStats ? mapOverlay(cityStats.data, metric) : null),
    [isStats, cityStats.data, metric],
  );
  const statsMoodData = useMemo(() => statsMoods(cityStats.data), [cityStats.data]);
  const mapMoods = isStats ? (statsMoodData ?? moods.data) : moods.data;

  // Факты для панели района, которым нужен весь город: место по настроению, среднее по городу,
  // площадь.
  const districtFacts = useMemo(() => {
    if (!districtSlug || !city.data) return null;
    const ranked = Object.entries(moods.data?.districts ?? {})
      .filter(([, aggregate]) => aggregate && !aggregate.insufficient_data)
      .sort((a, b) => b[1].score - a[1].score);
    const rank = ranked.findIndex(([slug]) => slug === districtSlug) + 1;
    const feature = city.data.districts.features.find((f) => f.properties.slug === districtSlug);
    return {
      rank: rank || null,
      rankTotal: ranked.length,
      cityAverage: ranked.length
        ? ranked.reduce((sum, [, aggregate]) => sum + aggregate.score, 0) / ranked.length
        : null,
      areaKm2: feature ? multiPolygonAreaKm2(feature.geometry.coordinates, city.data.center) : null,
    };
  }, [districtSlug, city.data, moods.data]);

  const content = isStats
    ? 'stats'
    : report
      ? `report:${reportStep}`
      : problem
        ? 'problem'
        : district
          ? 'district'
          : 'overview';
  const contentKey = `${content}:${districtSlug ?? ''}:${problem?.id ?? ''}`;
  const sheetSnap = sheetChoice.key === contentKey ? sheetChoice.snap : SHEET_SNAP[content];
  const unit = 16 * rootScale();

  // Панели выезжают, когда страница видна (после перехода страницы, если он был).
  useGSAP(
    () => {
      if (!entered) return;
      gsap.to(fadeRef.current, { autoAlpha: 0, duration: 0.9, ease: 'power2.out' });
      gsap.from('[data-panel="left"]', {
        x: -60,
        autoAlpha: 0,
        duration: 1,
        ease: 'expo.out',
        delay: 0.9,
      });
      gsap.from('[data-panel="right"]', {
        x: 60,
        autoAlpha: 0,
        duration: 1,
        ease: 'expo.out',
        delay: 1.05,
      });
      // clearProps: после анимации элементами снова управляет CSS («+» прячется, пока сообщают о
      // проблеме, чип центрируется своим transform).
      gsap.from('[data-panel="bottom"], [data-panel="corner"], [data-panel="float"]', {
        y: 40,
        autoAlpha: 0,
        duration: 0.8,
        ease: 'expo.out',
        delay: 1.3,
        clearProps: 'transform,opacity,visibility',
      });
    },
    { scope: pageRef, dependencies: [entered] },
  );

  // Переключение между картой и дашбордом: содержимое панелей поднимается.
  useGSAP(
    () => {
      if (viewRef.current === view) return;
      viewRef.current = view;
      gsap.fromTo(
        '[data-panel="left"] > *, [data-panel="right"] > *',
        { autoAlpha: 0, y: 16 },
        { autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.05, ease: 'power3.out' },
      );
    },
    { scope: pageRef, dependencies: [view] },
  );

  // Боковые панели: камера снова смотрит на весь экран.
  useEffect(() => {
    if (!sheetLayout) mapRef.current?.setViewInset(0);
  }, [sheetLayout]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const placeTooltip = () => {
    const { x, y } = pointerRef.current;
    if (tooltipRef.current)
      tooltipRef.current.style.transform = `translate(${x + 16}px, ${y + 16}px)`;
  };

  const moveTooltip = (event) => {
    pointerRef.current = { x: event.clientX, y: event.clientY };
    placeTooltip();
  };

  useLayoutEffect(placeTooltip, [hover]);

  // Шторка сообщает свою видимую высоту: центр камеры и плавающие кнопки следуют за ней.
  const onSheetInset = (visible) => {
    pageRef.current?.style.setProperty('--sheet-inset', `${visible}px`);
    mapRef.current?.setViewInset(visible);
  };

  const selectDistrict = (slug) => {
    if (isStats) {
      setFocus((current) => (current === slug ? null : slug));
      return;
    }
    setProblem(null);
    navigate(`/map/${citySlug}/district/${slug}`);
  };

  const closeDistrict = () => navigate(`/map/${citySlug}`);

  const openStats = () => {
    setProblem(null);
    setReport(false);
    setPlacement(null);
    navigate(`/map/${citySlug}/stats`);
  };

  const closeStats = () => {
    setFocus(null);
    mapRef.current?.previewDistrict(null);
    navigate(`/map/${citySlug}`);
  };

  const openDistrictFromStats = (slug) => {
    setFocus(null);
    mapRef.current?.previewDistrict(null);
    navigate(`/map/${citySlug}/district/${slug}`);
  };

  const setStatsPeriod = (code) => setSearchParams({ period: code }, { replace: true });

  const selectProblem = (next) => {
    setProblem(next);
    setLayer('problems');
    mapRef.current?.focusProblem(next);
  };

  const requireAuth = (reason) => setAuthReason(reason);

  const openMoodPicker = () => {
    if (!user) return requireAuth(texts.authReasons.mood);
    setPickerOpen(true);
  };

  const handlePickMood = async (code, slug) => {
    await postMood(slug, code);
    setPickerOpen(false);
    mapRef.current?.flashDistrict(slug);
    moods.reload();
    stats.reload();
    setToast(
      format(texts.toasts.moodSaved, { mood: MOOD_BY_CODE[code].label, district: nameOf(slug) }),
    );
  };

  const reportProblem = () => {
    if (!user) return requireAuth(texts.authReasons.problem);
    setProblem(null);
    setPlacement(null);
    setReportStep('category');
    setLayer('problems'); // показываем существующие метки, чтобы люди подтверждали, а не дублировали
    setReport(true);
  };

  const closeReport = () => {
    setReport(false);
    setPlacement(null);
  };

  const handleProblemCreated = (created) => {
    closeReport();
    problems.reload();
    stats.reload();
    setProblem(created);
    mapRef.current?.focusProblem(created);
    setToast(texts.toasts.problemSent);
  };

  const hoveredMood = hover?.kind === 'district' ? mapMoods?.districts[hover.slug] : null;
  const hoveredValue = hover?.kind === 'district' ? overlay?.values[hover.slug] : null;
  const updatedAt = (isStats ? cityStats.data : moods.data)?.updated_at;

  const filters = (
    <MapFilters
      view={view}
      cityName={city.data?.name ?? texts.cityFallback}
      sheet={sheetLayout}
      period={period}
      onPeriod={setPeriod}
      layer={layer}
      onLayer={setLayer}
      statsPeriod={statsPeriod}
      onStatsPeriod={setStatsPeriod}
      metric={metric}
      onMetric={setMetric}
      range={cityStats.data ? reportedRange(cityStats.data) : undefined}
      districts={districts}
      selectedSlug={districtSlug}
      onSelectDistrict={selectDistrict}
      updatedAt={updatedAt}
    />
  );

  const filterSummary = isStats
    ? `${STATS_PERIODS.find((p) => p.code === statsPeriod).label} · ${texts.stats.metrics[metric]}`
    : `${MOOD_PERIODS.find((p) => p.code === period).label} · ${texts.layers[layer]}`;

  // Панель для текущего состояния — одно и то же содержимое в боковой панели или в шторке.
  let detail;
  if (isStats) {
    detail = (
      <CityDashboard
        cityName={city.data?.name ?? texts.cityFallback}
        period={statsPeriod}
        stats={cityStats.data}
        loading={cityStats.loading}
        names={names}
        focusSlug={focus}
        onFocusDistrict={selectDistrict}
        onHoverDistrict={(slug) => mapRef.current?.previewDistrict(slug)}
        onOpenDistrict={openDistrictFromStats}
        onClose={sheetLayout ? closeStats : undefined}
      />
    );
  } else if (report) {
    detail = (
      <ReportProblem
        placement={placement}
        districtName={placement ? nameOf(placement.district) : ''}
        onClose={closeReport}
        onCreated={handleProblemCreated}
        onStepChange={setReportStep}
      />
    );
  } else if (problem) {
    detail = (
      <ProblemCard
        key={problem.id}
        problem={problem}
        districtName={nameOf(problem.district)}
        isGuest={!user}
        onRequireAuth={() => requireAuth(texts.authReasons.confirm)}
        onUpdated={(updated) => {
          setProblem(updated);
          problems.reload();
        }}
        onClose={() => setProblem(null)}
      />
    );
  } else if (district) {
    detail = (
      <DistrictPanel
        district={district}
        period={period}
        stats={stats.data?.district === districtSlug ? stats.data : null}
        facts={districtFacts}
        loading={stats.loading}
        onClose={closeDistrict}
        onMarkMood={openMoodPicker}
        onReportProblem={reportProblem}
        onSelectProblem={selectProblem}
      />
    );
  } else {
    detail = (
      <div className={styles.overview} data-ui="map-overview">
        <div data-sheet-drag>
          <p className={styles.kicker}>{texts.overview.kicker}</p>
          <h2 className={styles.subheading}>{texts.overview.title}</h2>
        </div>
        <DistrictRanking districts={districts} moods={moods.data} onSelect={selectDistrict} />
        <p className={styles.footnote}>{texts.overview.hint}</p>
      </div>
    );
  }

  const fabActions = isStats
    ? []
    : [
        {
          key: 'mood',
          primary: true,
          label: texts.actions.markMood,
          hint: texts.fab.markMoodHint,
          icon: <MoodFace mood="good" size={24} label="" />,
          onSelect: openMoodPicker,
        },
        {
          key: 'problem',
          label: texts.actions.reportProblem,
          hint: texts.fab.reportHint,
          icon: <PinIcon />,
          onSelect: reportProblem,
        },
        {
          key: 'stats',
          label: texts.statsLink.open,
          hint: texts.fab.statsHint,
          icon: <StatsIcon />,
          onSelect: openStats,
        },
      ];

  return (
    <div
      ref={pageRef}
      className={styles.page}
      data-layout={sheetLayout ? 'sheet' : 'panels'}
      data-ui="map-page"
      data-sheet-snap={sheetLayout ? sheetSnap : undefined}
      onPointerMove={moveTooltip}
    >
      <MapCanvas
        ref={mapRef}
        city={city.data}
        moods={mapMoods}
        problems={problems.data}
        layer={layer}
        overlay={overlay}
        selectedSlug={isStats ? focus : districtSlug}
        onHover={setHover}
        onSelectDistrict={selectDistrict}
        onSelectProblem={selectProblem}
        placing={report}
        onPlace={setPlacement}
      />

      {sheetLayout ? (
        <>
          <FilterChip summary={filterSummary}>{filters}</FilterChip>
          <MapFab
            actions={fabActions}
            onRecenter={() => mapRef.current?.recenter()}
            hidden={sheetSnap === 'full' || report}
          />
          <BottomSheet
            snap={sheetSnap}
            onSnapChange={(snap) => setSheetChoice({ key: contentKey, snap })}
            onInset={onSheetInset}
            label={texts.sheet.label}
            toggleLabel={texts.sheet.toggle}
            peek={Math.round((content === 'report:place' ? 15 : 6) * unit)}
            top={Math.round((isMobile ? 4.5 : 5.75) * unit)}
          >
            {detail}
          </BottomSheet>
        </>
      ) : (
        <>
          <aside
            className={`${styles.panel} ${styles.left}`}
            data-panel="left"
            data-ui="map-panel-left"
            aria-label={texts.filtersLabel}
          >
            {filters}
          </aside>

          <aside
            className={`${styles.panel} ${styles.right} ${isStats ? styles.wide : ''}`}
            data-panel="right"
            aria-live="polite"
          >
            {detail}
          </aside>

          {!report && (
            <div className={styles.corner} data-panel="corner">
              {isStats ? (
                <Button variant="ghost" onClick={closeStats}>
                  <BackIcon />
                  {texts.statsLink.back}
                </Button>
              ) : (
                <Button variant="ghost" onClick={openStats} title={texts.statsLink.openLabel}>
                  <StatsIcon />
                  {texts.statsLink.open}
                </Button>
              )}
            </div>
          )}

          {!report && !isStats && (
            <div className={styles.actionBar} data-panel="bottom">
              {!user && (
                <span className={styles.guestNote} data-ui="map-guest-note">
                  {texts.actions.guestNote}
                </span>
              )}
              <Button size="sm" variant="ghost" onClick={openMoodPicker}>
                {texts.actions.markMood}
              </Button>
              <Button size="sm" onClick={reportProblem}>
                {texts.actions.reportProblem}
              </Button>
              {!user && (
                <Button size="sm" variant="ghost" onClick={() => go('/login')}>
                  {texts.actions.login}
                </Button>
              )}
            </div>
          )}
        </>
      )}

      {hover && !sheetLayout && (
        <div ref={tooltipRef} className={styles.tooltip} role="tooltip">
          {hover.kind === 'district' ? (
            <>
              <MoodFace
                mood={
                  hoveredMood && !hoveredMood.insufficient_data
                    ? moodCodeForScore(hoveredMood.score)
                    : null
                }
                size={22}
                label=""
              />
              <span>{nameOf(hover.slug)}</span>
              {hoveredValue && <span className={styles.tooltipValue}>{hoveredValue}</span>}
            </>
          ) : (
            <span>
              {CATEGORY_BY_CODE[hover.problem.category].label} · {nameOf(hover.problem.district)}
            </span>
          )}
        </div>
      )}

      {pickerOpen && (
        <MoodPicker
          districts={districts}
          initialDistrict={districtSlug ?? user?.home_district}
          onPick={handlePickMood}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {authReason && (
        <Modal title={texts.authModal.title} onClose={() => setAuthReason(null)} width={420}>
          <p className={styles.modalText}>{authReason}</p>
          <div className={styles.modalActions}>
            <Button block onClick={() => go('/register')}>
              {texts.authModal.register}
            </Button>
            <Button block variant="ghost" onClick={() => go('/login')}>
              {texts.authModal.login}
            </Button>
          </div>
        </Modal>
      )}

      {toast && (
        <p className={styles.toast} role="status" data-ui="map-toast">
          {toast}
        </p>
      )}

      <p className={styles.attribution} data-ui="map-attribution">
        {texts.attribution.prefix}{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          {texts.attribution.osm}
        </a>
      </p>

      <div ref={fadeRef} className={styles.fade} aria-hidden="true" />
    </div>
  );
}
