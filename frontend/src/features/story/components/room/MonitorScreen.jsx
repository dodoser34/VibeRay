import { Icon } from '@/shared/ui/icons/Icon';
import about from '@/texts/ru/about.json';
import { isDaylight } from '../../lib/chapters';
import styles from './IsometricRoom.module.css';

// Идеи — строки списка в редакторе (ключ текста, вид значка); под списком печатается вопрос.
const IDEAS = [
  ['shop', 'site'],
  ['habits', 'chart'],
  ['game', 'app'],
  ['studyNetwork', 'site'],
  ['finance', 'chart'],
];
const ROW = 28;
const LIST_TOP = 80;
const QUESTION_Y = LIST_TOP + IDEAS.length * ROW + 34;
const KIND_TONE = { site: '--color-river', chart: '--mood-normal', app: '--district-8' };
const KIND_ICON = { site: 'link', chart: 'chart', app: 'smile' };
// Док: цвет значка и рисунок на нём.
const DOCK = [
  ['--color-accent', 'map'],
  ['--color-river', 'search'],
  ['--mood-normal', 'note'],
  ['--mood-bad', 'camera'],
  ['--district-8', 'chart'],
  ['--district-9', 'bell'],
  ['--color-text-muted', 'sliders'],
];
// Ширина символа строки меню (шрифт 8) — для раскладки пунктов меню по строке.
const MENU_CHAR = 4.6;

// Пункты меню друг за другом от x: ширина пункта — по числу символов.
function layoutMenu(items, x) {
  return items.reduce((menu, item) => {
    const last = menu.at(-1);
    const at = last ? last.x + last.item.length * MENU_CHAR + 12 : x;
    return [...menu, { item, x: at }];
  }, []);
}

// Рабочий стол на мониторе (рисунок 640 × 360): меню, папки, редактор с «Идея.txt», док. Идеи
// строками появляются в редакторе и зачёркиваются, под ними печатается вопрос, экран занимает карта города — сюжет общий с
// телефоном (data-screen, lib/screenTimeline.js). Подписи длиннее места ужимаются (data-fit).
export function MonitorScreen({ outline, mapBox }) {
  const { screen } = about;
  const menu = layoutMenu(screen.menu, 30 + screen.appName.length * MENU_CHAR + 14);
  return (
    <g className={styles.screenRoot}>
      <rect className={styles.wallpaper} width="640" height="360" />
      <path
        className={styles.contour}
        d="M0 250q120-60 240-10t250-30 150 20M0 290q140-50 260 0t240-20 140 10M60 0q40 80 140 90t180-40 260-20"
      />

      <rect className={styles.menuBar} width="640" height="16" />
      <circle className={styles.menuLogo} cx="14" cy="8" r="4" />
      <text className={styles.menuApp} x="26" y="11.4">
        {screen.appName}
      </text>
      {menu.map(({ item, x }) => (
        <text key={item} className={styles.menuItem} x={x} y="11.4">
          {item}
        </text>
      ))}
      <text className={styles.menuItem} x="630" y="11.4" textAnchor="end">
        {isDaylight() ? screen.dateDaylight : screen.date}
      </text>

      {screen.folders.map((label, k) => (
        <g key={label} transform={`translate(18 ${32 + k * 48})`}>
          <rect className={styles.folderTab} x="6" width="10" height="5" rx="1.5" />
          <rect className={styles.folder} x="6" y="3" width="24" height="17" rx="2" />
          <text className={styles.folderLabel} x="18" y="31" textAnchor="middle" data-fit="44">
            {label}
          </text>
        </g>
      ))}

      <rect className={styles.editor} x="150" y="50" width="340" height="240" rx="8" />
      <path className={styles.editorBar} d="M158 50h324a8 8 0 0 1 8 8v10H150V58a8 8 0 0 1 8-8z" />
      {['--mood-angry', '--mood-normal', '--mood-excellent'].map((token, k) => (
        <circle key={token} cx={162 + k * 11} cy="59" r="3.2" style={{ fill: `var(${token})` }} />
      ))}
      <text className={styles.editorTitle} x="320" y="62" textAnchor="middle">
        {screen.fileName}
      </text>
      {[...IDEAS.keys(), IDEAS.length].map((k) => (
        <path
          key={k}
          className={styles.gutter}
          d={`M160 ${k < IDEAS.length ? LIST_TOP + k * ROW + 15 : QUESTION_Y - 5}h6`}
        />
      ))}
      <g data-screen="ideas">
        {IDEAS.map(([key, kind], k) => (
          <g key={key} transform={`translate(172 ${LIST_TOP + k * ROW})`}>
            <g data-screen="idea">
              <rect className={styles.ideaCard} width="200" height="22" rx="5" />
              <rect
                x="7"
                y="5"
                width="12"
                height="12"
                rx="3"
                style={{ fill: `var(${KIND_TONE[kind]})` }}
              />
              <Icon
                className={styles.screenIcon}
                name={KIND_ICON[kind]}
                size="8"
                x="9"
                y="7"
                color="var(--color-bg-deep)"
                strokeWidth="2.6"
              />
              <text className={styles.ideaLabel} x="26" y="14.5" data-fit="166">
                {screen.ideas[key]}
              </text>
              <path className={styles.strike} data-screen="strike" d="M4 11h192" />
            </g>
          </g>
        ))}
      </g>
      <text
        className={styles.typing}
        x="172"
        y={QUESTION_Y}
        data-fit="300"
        data-fit-text={screen.question}
      >
        <tspan data-screen="typed" />
        <tspan className={styles.caret}>|</tspan>
      </text>

      <rect className={styles.dock} x="216" y="326" width="208" height="26" rx="9" />
      {DOCK.map(([token, icon], k) => (
        <g key={token}>
          <rect
            x={224 + k * 28}
            y="330"
            width="18"
            height="18"
            rx="5"
            style={{ fill: `var(${token})` }}
          />
          <Icon
            className={styles.screenIcon}
            name={icon}
            size="11"
            x={227.5 + k * 28}
            y="333.5"
            color="var(--color-bg-deep)"
            strokeWidth="2.4"
          />
        </g>
      ))}
      <path className={styles.pointer} d="M520 296l0 16 4-4 3 7 3-1.4-3-6.8h6z" />

      {outline && (
        <g data-screen="map">
          <rect className={styles.screenMapBg} width="640" height="360" />
          <svg
            width="640"
            height="360"
            viewBox={(mapBox ?? outline.viewBox).join(' ')}
            preserveAspectRatio={mapBox ? 'none' : 'xMidYMid meet'}
          >
            {outline.districts.map((district) => (
              <path
                key={district.slug}
                d={district.d}
                className={styles.mapDistrict}
                style={{ '--fill': `var(--district-${district.palette})` }}
              />
            ))}
          </svg>
        </g>
      )}
    </g>
  );
}
