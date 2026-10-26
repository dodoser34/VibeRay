import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { MoodFace } from '@/features/mood';
import { CategoryIcon } from '@/features/problems';
import { gsap, useGSAP } from '@/shared/animations/core/gsapSetup';
import { STATUS_BY_CODE } from '@/shared/config/problemStatuses';
import { useLanguage } from '@/shared/hooks/useLanguage';
import { formatNumber } from '@/shared/lib/i18n/formatNumber';
import { Avatar } from '@/shared/ui/avatar/Avatar';
import { Icon } from '@/shared/ui/icons/Icon';
import home from '@/texts/ru/home.json';
import { usePointerParallax } from '../hooks/usePointerParallax';
import styles from './HeroThoughts.module.css';

// Мысли жителя — пять разных видов, идут вперемешку, чтобы соседние облачка не были похожи:
// ask — вопрос и шкала лиц настроения, по которой бежит выбор; joy — крупное лицо, которое
// покачивается; solved — решённая проблема: иконка категории, галочка и статус «решена»;
// confirm — аватары соседей и счётчик подтверждений; district — полоса настроений района растёт.
const THOUGHTS = [
  { kind: 'ask', key: 'mood' },
  { kind: 'solved', key: 'roads', category: 'roads' },
  { kind: 'confirm', key: 'confirm', count: 14, avatars: [1, 4, 6] },
  { kind: 'joy', key: 'great', mood: 'excellent' },
  { kind: 'solved', key: 'garbage', category: 'garbage' },
  { kind: 'district', key: 'district' },
  { kind: 'solved', key: 'lighting', category: 'lighting' },
  { kind: 'joy', key: 'love', mood: 'good' },
  { kind: 'solved', key: 'transport', category: 'public_transport' },
  { kind: 'confirm', key: 'confirm', count: 27, avatars: [2, 0, 7] },
  { kind: 'solved', key: 'parks', category: 'parks' },
  { kind: 'district', key: 'district' },
  { kind: 'solved', key: 'noise', category: 'noise' },
];
const ASK_MOODS = ['very_bad', 'bad', 'normal', 'good', 'excellent'];
// Доли настроений в полосе района — от лучшего к худшему (токены --mood-*).
const DISTRICT_BAR = [
  ['--mood-excellent', 34],
  ['--mood-good', 28],
  ['--mood-normal', 20],
  ['--mood-anxious', 11],
  ['--mood-bad', 7],
];
// С какой стороны головы всплывает очередная мысль — угол от центра головы (градусы, 0 — вправо,
// −90 — вверх), стороны чередуются. Широкий экран: справа сверху, слева сверху, справа, над головой
// (левее — колонка с формой, туда облачко не заходит). Одна колонка: справа от головы, на полосе
// рядом с девушкой (HeroGirl сдвинута влево). Облачко растёт от угла, ближнего к голове.
const SIDES = { wide: [-35, -145, 8, -100], stacked: [-15, 25] };
const SHOW_MS = 3600;
const SWAP_MS = 700;
const DOTS = 3;
// Мысли — передний план: за указателем сдвигаются сильнее девушки, отсюда ощущение глубины.
const DEPTH = {
  move: (px, py) => ({ x: px * 22, y: py * 14 }),
  idle: (t) => ({ x: t * 6 }),
};
// Отступ облачка от края сцены, px.
const PAD = 12;
// Широкий экран: левее этой доли ширины — колонка с формой, облачко туда не заходит.
const COLUMN_SHARE = 0.47;
// Одна колонка: столько px снизу сцены перекрывает заголовок (поднят отрицательным отступом).
const STACKED_BOTTOM = 56;

// Мысли девушки: облачко с цепочкой кружков от головы всплывает, держится и тает, следующее —
// с другой стороны. Сменяются по очереди, без перескоков и покачиваний. anchor() — центр и радиус
// головы в px слоя (HeroGirl.headPoint). Цикл идёт по реальным таймерам, а не по шкале GSAP: при
// reduced motion GSAP ускорен в 20 раз, и мысли мелькали бы. Уход к карте гасит слой (fade).
export function HeroThoughts({ ref, active, stacked = false, anchor }) {
  useLanguage();
  const rootRef = useRef(null);
  const bubbleRef = useRef(null);
  const [cycle, setCycle] = useState(0);
  usePointerParallax(rootRef, DEPTH);
  const thought = cycle ? THOUGHTS[(cycle - 1) % THOUGHTS.length] : null;

  useEffect(() => {
    if (!active) {
      // Мысли остановлены (героиня сменилась) — показанное облачко тает.
      const root = rootRef.current;
      gsap.killTweensOf(root.children);
      gsap.to(root.children, { autoAlpha: 0, duration: 0.3 });
      return undefined;
    }
    let timer = null;
    const next = () => {
      setCycle((value) => value + 1);
      timer = setTimeout(next, SHOW_MS + SWAP_MS);
    };
    timer = setTimeout(next, 400);
    return () => clearTimeout(timer);
  }, [active]);

  useGSAP(
    (context, contextSafe) => {
      if (!cycle) return undefined;
      const head = anchor();
      const root = rootRef.current;
      const bubble = bubbleRef.current;
      const dots = gsap.utils.toArray('[data-dot]');
      if (!head) return undefined;
      // Прошлое облачко уже растаяло; его недоигранные движения не должны сбить новое.
      gsap.killTweensOf([bubble, ...dots]);
      // Слой мыслей начинается под таб-баром — точка головы дана от верха сцены.
      head.y -= root.offsetTop;

      const sides = stacked ? SIDES.stacked : SIDES.wide;
      const w = bubble.offsetWidth;
      const h = bubble.offsetHeight;
      const minLeft = stacked ? PAD : root.clientWidth * COLUMN_SHARE;
      const maxLeft = root.clientWidth - w - PAD;
      const maxTop = root.clientHeight - h - (stacked ? STACKED_BOTTOM : PAD);
      // Место облачка для направления от головы: угол облачка, ближний к голове, — на луче, облачко
      // растёт от него наружу и не выходит за допустимую область. Цена места — насколько облачко
      // перекрывает голову (квадрат вокруг неё) и насколько его пришлось сдвинуть от луча.
      const place = (degrees) => {
        const a = (degrees * Math.PI) / 180;
        const d = { x: Math.cos(a), y: Math.sin(a) };
        const corner = { x: head.x + d.x * head.radius * 1.5, y: head.y + d.y * head.radius * 1.5 };
        const wantLeft = d.x >= 0 ? corner.x : corner.x - w;
        const wantTop = d.y < 0 ? corner.y - h : corner.y;
        const left = gsap.utils.clamp(minLeft, Math.max(minLeft, maxLeft), wantLeft);
        const top = gsap.utils.clamp(PAD, Math.max(PAD, maxTop), wantTop);
        const r = head.radius * 1.05;
        const overlapX = Math.max(0, Math.min(left + w, head.x + r) - Math.max(left, head.x - r));
        const overlapY = Math.max(0, Math.min(top + h, head.y + r) - Math.max(top, head.y - r));
        const shift = Math.abs(left - wantLeft) + Math.abs(top - wantTop);
        return { dir: d, corner, left, top, cost: overlapX * overlapY + shift * 0.5 };
      };
      // Сначала сторона по очереди, затем запасные — зеркальная и над головой; берётся первая
      // свободная, а если свободных нет — с наименьшим перекрытием.
      const preferred = sides[(cycle - 1) % sides.length];
      const options = [
        preferred,
        180 - preferred,
        ...(stacked ? [-45, 50, 0] : [-90, -60, -120]),
      ].map(place);
      const { dir, corner, left, top } =
        options.find((option) => option.cost < 1) ??
        options.reduce((best, option) => (option.cost < best.cost ? option : best));
      // Кружки — от края головы (у виска, если облачко ниже) к углу облачка, от маленького к
      // большому.
      const from =
        dir.y > 0
          ? { x: head.x + Math.sign(dir.x) * head.radius * 0.9, y: head.y }
          : { x: head.x + dir.x * head.radius * 0.95, y: head.y + dir.y * head.radius * 0.95 };
      const to = {
        x: gsap.utils.clamp(left, left + w, corner.x),
        y: gsap.utils.clamp(top, top + h, corner.y),
      };
      dots.forEach((dot, i) => {
        const t = (i + 1) / (DOTS + 1);
        gsap.set(dot, {
          x: from.x + (to.x - from.x) * t - dot.offsetWidth / 2,
          y: from.y + (to.y - from.y) * t - dot.offsetHeight / 2,
        });
      });
      gsap.set(bubble, { x: left, y: top, transformOrigin: `${to.x - left}px ${to.y - top}px` });

      const timeline = gsap
        .timeline()
        .fromTo(
          dots,
          { scale: 0, autoAlpha: 0 },
          { scale: 1, autoAlpha: 1, duration: 0.25, ease: 'back.out(2)', stagger: 0.12 },
        )
        .fromTo(
          bubble,
          { scale: 0.4, autoAlpha: 0 },
          { scale: 1, autoAlpha: 1, duration: 0.5, ease: 'back.out(1.4)' },
          '-=0.1',
        );
      timeline
        .from('[data-thought-content]', { autoAlpha: 0, y: 6, duration: 0.35 }, '-=0.15')
        .add(play(thought.kind), '-=0.1');

      const timer = setTimeout(
        contextSafe(() => {
          gsap.to(bubble, { autoAlpha: 0, scale: 0.85, duration: 0.4, ease: 'power2.in' });
          gsap.to(dots, { autoAlpha: 0, duration: 0.3, stagger: { each: 0.06, from: 'end' } });
        }),
        SHOW_MS,
      );
      return () => clearTimeout(timer);

      // Своё короткое движение внутри облачка у каждого вида мысли.
      function play(kind) {
        if (kind === 'ask') {
          return gsap
            .timeline()
            .from('[data-face]', { scale: 0, duration: 0.3, ease: 'back.out(2.4)', stagger: 0.07 })
            .to('[data-face]:last-child', { scale: 1.25, duration: 0.3, ease: 'back.out(3)' });
        }
        if (kind === 'joy') {
          return gsap.from('[data-face]', { scale: 0.5, duration: 0.5, ease: 'back.out(2.4)' });
        }
        if (kind === 'solved') {
          return gsap
            .timeline()
            .from('[data-check]', { scale: 0, duration: 0.35, ease: 'back.out(3)' })
            .from('[data-chip]', { autoAlpha: 0, x: -8, duration: 0.3 }, '-=0.15');
        }
        if (kind === 'confirm') {
          return gsap
            .timeline()
            .from('[data-avatar]', { x: -10, autoAlpha: 0, duration: 0.3, stagger: 0.1 })
            .from('[data-count]', { scale: 0, duration: 0.35, ease: 'back.out(3)' }, '-=0.1');
        }
        return gsap.from('[data-segment]', {
          scaleX: 0,
          transformOrigin: '0 50%',
          duration: 0.5,
          ease: 'power2.out',
          stagger: 0.08,
        });
      }
    },
    { scope: rootRef, dependencies: [cycle] },
  );

  useImperativeHandle(
    ref,
    () => ({
      fade: (progress) => gsap.set(rootRef.current, { autoAlpha: 1 - Math.min(1, progress * 3) }),
    }),
    [],
  );

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-stacked={stacked || undefined}
      aria-hidden="true"
    >
      {Array.from({ length: DOTS }, (_, i) => (
        <span key={i} className={styles.dot} data-dot style={{ '--dot': i }} />
      ))}
      <div ref={bubbleRef} className={styles.bubble}>
        {thought && (
          <div key={cycle} className={styles.content} data-kind={thought.kind} data-thought-content>
            <ThoughtVisual thought={thought} />
            <span className={styles.text}>{home.thoughts[thought.key]}</span>
            {thought.kind === 'solved' && (
              <span className={styles.chip} data-chip>
                {STATUS_BY_CODE.resolved.label}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ThoughtVisual({ thought }) {
  if (thought.kind === 'ask') {
    return (
      <span className={styles.faces}>
        {ASK_MOODS.map((mood) => (
          <span key={mood} data-face>
            <MoodFace mood={mood} size={26} label="" />
          </span>
        ))}
      </span>
    );
  }
  if (thought.kind === 'joy') {
    return (
      <span className={styles.joy} data-face>
        <MoodFace mood={thought.mood} size={44} label="" />
      </span>
    );
  }
  if (thought.kind === 'solved') {
    return (
      <span className={styles.solved}>
        <CategoryIcon category={thought.category} size={22} />
        <span className={styles.check} data-check>
          <Icon name="check" size={12} strokeWidth={3} />
        </span>
      </span>
    );
  }
  if (thought.kind === 'confirm') {
    return (
      <span className={styles.crowd}>
        {thought.avatars.map((preset) => (
          <span key={preset} className={styles.avatar} data-avatar>
            <Avatar src={`preset:${preset}`} size={28} />
          </span>
        ))}
        <span className={styles.count} data-count>
          +{formatNumber(thought.count)}
        </span>
      </span>
    );
  }
  return (
    <span className={styles.bar}>
      {DISTRICT_BAR.map(([token, share]) => (
        <span
          key={token}
          className={styles.segment}
          data-segment
          style={{ flexGrow: share, background: `var(${token})` }}
        />
      ))}
    </span>
  );
}
