import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useTransitionNavigate, useTransitionReady } from '@/app/transitions/useTransition';
import { useViewport } from '@/adaptations/core';
import { useAuth } from '@/features/auth';
import { MapCanvas } from '@/features/map';
import { DistrictRanking, MoodPicker } from '@/features/mood';
import { ProblemCard, ReportProblem } from '@/features/problems';
import { CityDashboard, DistrictPanel, reportedRange } from '@/features/stats';
import { postMood } from '@/shared/api/endpoints/districts';
import { MOOD_BY_CODE } from '@/shared/config/moods';
import { DEFAULT_STATS_PERIOD, MOOD_PERIODS, STATS_PERIODS } from '@/shared/config/periods';
import { usePageEntered } from '@/shared/hooks/usePageEntered';
import { useLocalizedNavigate } from '@/shared/hooks/useLocalizedNavigate';
import { Button } from '@/shared/ui/controls/Button';
import { CoachMarks } from '@/shared/ui/windows/CoachMarks';
import { format } from '@/shared/lib/i18n/format';
import problemTexts from '@/texts/en/problems.json';
import texts from '@/texts/en/map.json';
import { useLanguage } from '@/shared/hooks/useLanguage';
import { panelContent } from './lib/mapState';
import { MapFilters } from './components/filters/MapFilters';
import { MapPanelsLayout } from './components/layout/MapPanelsLayout';
import { MapSheetLayout } from './components/layout/MapSheetLayout';
import { MapNotice } from './components/MapNotice';
import { AuthRequiredModal } from './components/overlays/AuthRequiredModal';
import { MapAttribution } from './components/overlays/MapAttribution';
import { MapToast } from './components/overlays/MapToast';
import { MapTooltip } from './components/overlays/MapTooltip';
import { useFollowTooltip } from './hooks/useFollowTooltip';
import { useDistrictsVisible } from './hooks/useDistrictsVisible';
import { useHeightScale } from './hooks/useHeightScale';
import { useMapTour } from './hooks/useMapTour';
import { usePanelVisibility } from './hooks/usePanelVisibility';
import { useMapPageAnimations } from './hooks/useMapPageAnimations';
import { useMapPageData } from './hooks/useMapPageData';
import { useToast } from './hooks/useToast';
import cheerFigure from './assets/cheer.webp';
import guideFigure from './assets/guide.webp';
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

// Одна страница, два вида одной 3D-карты (карта никогда не монтируется заново): вид «map»
// (/map/:city, /map/:city/district/:slug) — живое настроение, проблемы, панель района; вид «stats»
// (/map/:city/stats?period=) — дашборд города за месяц, год или все годы, нарисованный на районах.
// Две раскладки (src/adaptations): боковые панели на десктопах и планшетах в альбомной ориентации;
// на телефонах и планшетах стоя карта занимает экран — фильтры сворачиваются в чип, действия — в
// кнопку «+», каждая панель открывается в шторке.
export function MapPage({ view = 'map' }) {
  // Страница — корень своей ветки: при смене языка перерисовывается вместе со всем содержимым.
  useLanguage();
  const { citySlug, districtSlug, problemId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useLocalizedNavigate();
  const go = useTransitionNavigate();
  const { user } = useAuth();
  const { compact: sheetLayout } = useViewport();
  const isStats = view === 'stats';
  const [period, setPeriod] = useState('day');
  const [layer, setLayer] = useState(problemId ? 'problems' : 'districts');
  const [metric, setMetric] = useState('mood');
  const [focus, setFocus] = useState(null); // район, подсвеченный на дашборде
  const [hover, setHover] = useState(null);
  // Свежая версия открытой проблемы после подтверждения или отправки (без повторного запроса)
  const [problemUpdate, setProblemUpdate] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [report, setReport] = useState(false);
  const [reportStep, setReportStep] = useState('category');
  const [placement, setPlacement] = useState(null); // { district, location }, выбранные на карте
  const [authReason, setAuthReason] = useState(null);
  const [toast, setToast] = useToast(TOAST_MS);
  // Положение шторки, выбранное пользователем, запоминается для того содержимого, при котором его
  // выбрали.
  const [sheetChoice, setSheetChoice] = useState({ key: null, snap: null });
  const [heightScale, changeHeightScale] = useHeightScale();
  const [districtsVisible, changeDistrictsVisible] = useDistrictsVisible();

  const requestedPeriod = searchParams.get('period');
  const statsPeriod = STATS_PERIODS.some((option) => option.code === requestedPeriod)
    ? requestedPeriod
    : DEFAULT_STATS_PERIOD;

  const {
    city,
    moods,
    problems,
    cities,
    stats,
    cityStats,
    problem,
    problemMissing,
    districts,
    names,
    overlay,
    mapMoods,
    districtFacts,
    mapProblems,
  } = useMapPageData({
    citySlug,
    districtSlug,
    problemId,
    isStats,
    period,
    statsPeriod,
    metric,
    problemUpdate,
    userId: user?.id,
  });
  // Переход страницы ждёт город и его настроения, прежде чем сложиться.
  useTransitionReady(Boolean(city.data && moods.data));
  const entered = usePageEntered();

  const pageRef = useRef(null);
  const mapRef = useRef(null);
  const fadeRef = useRef(null);

  const nameOf = (slug) => names[slug] ?? '';
  const district =
    !isStats && districtSlug ? { slug: districtSlug, name: nameOf(districtSlug) } : null;

  const focusedRef = useRef(null);
  useEffect(() => {
    if (!problem) {
      focusedRef.current = null;
      return;
    }
    if (focusedRef.current === problem.id) return;
    focusedRef.current = problem.id;
    mapRef.current?.focusProblem(problem);
  }, [problem]);

  // Подсказки при первом визите: когда карта уже показалась, а посетитель ещё ничего не открыл.
  const { tourOpen, tourSteps, openTour, finishTour } = useMapTour({
    ready: entered && Boolean(city.data && moods.data) && !isStats && !problemId,
    homeDistrict: user?.home_district,
    compact: sheetLayout,
  });

  const content = panelContent({
    isStats,
    report,
    reportStep,
    showsProblem: Boolean(problem || problemMissing),
    district,
  });
  const contentKey = `${content}:${districtSlug ?? ''}:${problem?.id ?? ''}`;
  const sheetSnap = sheetChoice.key === contentKey ? sheetChoice.snap : SHEET_SNAP[content];
  const { leftHidden, rightHidden, toggleLeft, toggleRight } = usePanelVisibility(contentKey);

  // Что в панели — без шага формы «Сообщить о проблеме» (шаги она анимирует сама) и без фокуса района
  // на дашборде: смена ключа поднимает новое содержимое панели.
  const detailKey = isStats
    ? 'stats'
    : report
      ? 'report'
      : `${content}:${districtSlug ?? ''}:${problem?.id ?? ''}`;
  useMapPageAnimations({ pageRef, fadeRef, entered, view, detailKey });

  // Боковые панели: камера снова смотрит на весь экран.
  useEffect(() => {
    if (!sheetLayout) mapRef.current?.setViewInset(0);
  }, [sheetLayout]);

  const { tooltipRef, onPointerMove } = useFollowTooltip(hover);

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
    navigate(`/map/${citySlug}/district/${slug}`);
  };

  const closeDistrict = () => navigate(`/map/${citySlug}`);

  const openStats = () => {
    setReport(false);
    setPlacement(null);
    navigate(`/map/${citySlug}/stats`);
  };

  const closeStats = () => {
    setFocus(null);
    mapRef.current?.previewDistrict(null);
    navigate(`/map/${citySlug}`);
  };

  // Другой город: открытые район, проблема и сообщение остаются в прежнем городе, вид (карта или
  // статистика и её период) сохраняется.
  const changeCity = (slug) => {
    if (slug === citySlug) return;
    setReport(false);
    setPlacement(null);
    setFocus(null);
    navigate(isStats ? `/map/${slug}/stats?${searchParams}` : `/map/${slug}`);
  };

  const openDistrictFromStats = (slug) => {
    setFocus(null);
    mapRef.current?.previewDistrict(null);
    navigate(`/map/${citySlug}/district/${slug}`);
  };

  const setStatsPeriod = (code) => setSearchParams({ period: code }, { replace: true });

  const selectProblem = (next) => {
    setLayer('problems');
    navigate(`/map/${citySlug}/problem/${next.id}`);
  };

  const closeProblem = () => navigate(`/map/${citySlug}`);

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
    setToast({
      text: format(texts.toasts.moodSaved, {
        mood: MOOD_BY_CODE[code].label,
        district: nameOf(slug),
      }),
    });
  };

  const reportProblem = () => {
    if (!user) return requireAuth(texts.authReasons.problem);
    if (problemId) closeProblem();
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
    setProblemUpdate(created);
    navigate(`/map/${citySlug}/problem/${created.id}`);
    setToast({ text: texts.toasts.problemSent, figure: cheerFigure });
  };

  const hoveredMood = hover?.kind === 'district' ? mapMoods?.districts[hover.slug] : null;
  const hoveredValue = hover?.kind === 'district' ? overlay?.values[hover.slug] : null;
  const updatedAt = (isStats ? cityStats.data : moods.data)?.updated_at;

  const filters = (
    <MapFilters
      view={view}
      cityName={city.data?.name ?? texts.cityFallback}
      cities={cities.data}
      citySlug={citySlug}
      onCity={changeCity}
      sheet={sheetLayout}
      period={period}
      onPeriod={setPeriod}
      layer={layer}
      onLayer={setLayer}
      statsPeriod={statsPeriod}
      onStatsPeriod={setStatsPeriod}
      metric={metric}
      onMetric={setMetric}
      heightScale={heightScale}
      onHeightScale={changeHeightScale}
      districtsVisible={districtsVisible}
      onDistrictsVisible={changeDistrictsVisible}
      range={cityStats.data ? reportedRange(cityStats.data) : undefined}
      districts={districts}
      selectedSlug={districtSlug}
      onSelectDistrict={selectDistrict}
      updatedAt={updatedAt}
      onHelp={isStats ? undefined : openTour}
    />
  );

  const filterSummary = isStats
    ? `${STATS_PERIODS.find((option) => option.code === statsPeriod).label} · ${texts.stats.metrics[metric]}`
    : `${MOOD_PERIODS.find((option) => option.code === period).label} · ${texts.layers[layer]}`;

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
  } else if (problemMissing) {
    detail = (
      <MapNotice
        dataUi="map-detail"
        kicker={problemTexts.card.label}
        title={problemTexts.card.notFoundTitle}
        note={problemTexts.card.notFound}
        action={
          <Button variant="ghost" onClick={closeProblem}>
            {problemTexts.card.backToMap}
          </Button>
        }
      />
    );
  } else if (problem) {
    detail = (
      <ProblemCard
        key={problem.id}
        problem={problem}
        citySlug={citySlug}
        districtName={nameOf(problem.district)}
        isGuest={!user}
        onRequireAuth={() => requireAuth(texts.authReasons.confirm)}
        onUpdated={(updated) => {
          setProblemUpdate(updated);
          problems.reload();
        }}
        onWithdrawn={() => {
          closeProblem();
          problems.reload();
          stats.reload();
          setToast({ text: texts.toasts.problemWithdrawn });
        }}
        onClose={closeProblem}
      />
    );
  } else if (district) {
    detail = (
      <DistrictPanel
        district={district}
        cityName={city.data?.name ?? texts.cityFallback}
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
      <MapNotice
        dataUi="map-overview"
        kicker={texts.overview.kicker}
        title={texts.overview.title}
        note={texts.overview.hint}
      >
        <DistrictRanking districts={districts} moods={moods.data} onSelect={selectDistrict} />
      </MapNotice>
    );
  }

  return (
    <div
      ref={pageRef}
      className={styles.page}
      data-layout={sheetLayout ? 'sheet' : 'panels'}
      data-ui="map-page"
      data-sheet-snap={sheetLayout ? sheetSnap : undefined}
      onPointerMove={onPointerMove}
    >
      <MapCanvas
        ref={mapRef}
        city={city.data}
        moods={mapMoods}
        problems={mapProblems}
        layer={layer}
        overlay={overlay}
        heightScale={heightScale}
        districtsVisible={districtsVisible}
        selectedSlug={isStats ? focus : districtSlug}
        selectedProblemId={problem?.id ?? null}
        onHover={setHover}
        onSelectDistrict={selectDistrict}
        onSelectProblem={selectProblem}
        placing={report}
        onPlace={setPlacement}
      />

      {sheetLayout ? (
        <MapSheetLayout
          filters={filters}
          filterSummary={filterSummary}
          detail={detail}
          content={content}
          isStats={isStats}
          report={report}
          snap={sheetSnap}
          onSnapChange={(snap) => setSheetChoice({ key: contentKey, snap })}
          onInset={onSheetInset}
          onRecenter={() => mapRef.current?.recenter()}
          onMarkMood={openMoodPicker}
          onReportProblem={reportProblem}
          onOpenStats={openStats}
        />
      ) : (
        <MapPanelsLayout
          filters={filters}
          detail={detail}
          isStats={isStats}
          report={report}
          isGuest={!user}
          leftHidden={leftHidden}
          rightHidden={rightHidden}
          onToggleLeft={toggleLeft}
          onToggleRight={toggleRight}
          onOpenStats={openStats}
          onCloseStats={closeStats}
          onMarkMood={openMoodPicker}
          onReportProblem={reportProblem}
          onLogin={() => go('/login')}
        />
      )}

      {hover && !sheetLayout && (
        <MapTooltip
          ref={tooltipRef}
          hover={hover}
          mood={hoveredMood}
          value={hoveredValue}
          names={names}
        />
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
        <AuthRequiredModal
          reason={authReason}
          onClose={() => setAuthReason(null)}
          onNavigate={go}
        />
      )}

      {tourOpen && (
        <CoachMarks
          steps={tourSteps}
          labels={texts.tour}
          figure={guideFigure}
          onFinish={finishTour}
        />
      )}

      {toast && <MapToast toast={toast} />}

      <MapAttribution />

      <div ref={fadeRef} className={styles.fade} aria-hidden="true" />
    </div>
  );
}
