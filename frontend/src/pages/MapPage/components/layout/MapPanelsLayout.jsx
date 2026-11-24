import { Button } from '@/shared/ui/controls/Button';
import { Icon } from '@/shared/ui/icons/Icon';
import texts from '@/texts/en/map.json';
import { PanelToggle } from './PanelToggle';
import styles from './MapPanelsLayout.module.css';

// Раскладка «панели» (десктопы, планшеты лёжа): фильтры — в левой панели, содержимое (район,
// проблема, дашборд) — в правой, обе прячутся язычком; внизу слева — путь к дашборду и обратно, по
// центру — действия. data-panel — цели анимации появления в MapPage.
export function MapPanelsLayout({
  filters,
  detail,
  isStats,
  report,
  isGuest,
  leftHidden,
  rightHidden,
  onToggleLeft,
  onToggleRight,
  onOpenStats,
  onCloseStats,
  onMarkMood,
  onReportProblem,
  onLogin,
}) {
  return (
    <>
      <aside
        className={`${styles.panel} ${styles.left}`}
        data-panel="left"
        data-ui="map-panel-left"
        data-hidden={leftHidden || undefined}
        aria-label={texts.filtersLabel}
      >
        <div
          id="map-panel-left"
          className={styles.leftBody}
          data-panel-body
          data-ui="map-panel-left-body"
          inert={leftHidden || undefined}
        >
          {filters}
        </div>
        <PanelToggle
          side="left"
          hidden={leftHidden}
          controls="map-panel-left"
          label={leftHidden ? texts.panels.showLeft : texts.panels.hideLeft}
          onToggle={onToggleLeft}
        />
      </aside>

      <aside
        className={`${styles.panel} ${styles.right} ${isStats ? styles.wide : ''}`}
        data-panel="right"
        data-hidden={rightHidden || undefined}
        aria-live="polite"
      >
        <div
          id="map-panel-right"
          className={styles.rightBody}
          data-panel-body
          inert={rightHidden || undefined}
        >
          {detail}
        </div>
        <PanelToggle
          side="right"
          hidden={rightHidden}
          controls="map-panel-right"
          label={rightHidden ? texts.panels.showRight : texts.panels.hideRight}
          onToggle={onToggleRight}
        />
      </aside>

      {!report && (
        <div className={styles.corner} data-panel="corner">
          {isStats ? (
            <Button variant="ghost" onClick={onCloseStats}>
              <Icon name="chevron-left" size={16} className={`${styles.icon} ${styles.back}`} />
              {texts.statsLink.back}
            </Button>
          ) : (
            <Button variant="ghost" onClick={onOpenStats} title={texts.statsLink.openLabel}>
              <Icon name="stats" size={16} className={styles.icon} />
              {texts.statsLink.open}
            </Button>
          )}
        </div>
      )}

      {!report && !isStats && (
        <div className={styles.actionBar} data-panel="bottom">
          {isGuest && (
            <span className={styles.guestNote} data-ui="map-guest-note">
              {texts.actions.guestNote}
            </span>
          )}
          <Button size="sm" variant="ghost" onClick={onMarkMood} data-onboarding="mood">
            {texts.actions.markMood}
          </Button>
          <Button size="sm" onClick={onReportProblem} data-onboarding="report">
            {texts.actions.reportProblem}
          </Button>
          {isGuest && (
            <Button size="sm" variant="ghost" onClick={onLogin}>
              {texts.actions.login}
            </Button>
          )}
        </div>
      )}
    </>
  );
}
