import { useRef } from 'react';
import { gsap, useGSAP } from '@/shared/animations/core/gsapSetup';
import about from '@/texts/ru/about.json';
import handPhoto from '../../assets/phone-hand.webp';
import { CHAPTERS, isDaylight } from '../../lib/chapters';
import { PhoneScreen } from './PhoneScreen';
import styles from './PhoneStage.module.css';

// История «О проекте» на телефонах и планшетах: рука достаёт телефон снизу (фото руки с телефоном,
// экран в нём прозрачный), и вся история идёт на экране под фото — экран блокировки, «Заметки»,
// затем 3D-город (canvas) и оверлей истории (children) в телефонном виде. Телефон стоя или лёжа —
// как держат само устройство (orientation). Шкалу прокрутки строит StoryExperience
// (lib/phoneTimeline.js), здесь — только появление руки, когда сцена готова: один раз, без привязки
// к прокрутке.
export function PhoneStage({
  ref,
  screenRef,
  canvasRef,
  outline,
  orientation,
  ready,
  reduced,
  children,
}) {
  const liftRef = useRef(null);
  const liftedRef = useRef(false);
  const time = isDaylight() ? about.phone.timeDaylight : about.phone.time;

  useGSAP(
    () => {
      if (reduced || liftedRef.current) return;
      if (!ready) {
        gsap.set(liftRef.current, { yPercent: 75, rotation: 9, transformOrigin: '50% 100%' });
        return;
      }
      liftedRef.current = true;
      gsap.to(liftRef.current, {
        yPercent: 0,
        rotation: 0,
        duration: 1.5,
        delay: 0.2,
        ease: 'power3.out',
      });
    },
    { dependencies: [ready, reduced] },
  );

  return (
    <div ref={ref} className={styles.stage} data-orientation={orientation}>
      <div ref={liftRef} className={styles.lift}>
        <div className={styles.device} data-phone="device">
          <div ref={screenRef} className={styles.screen}>
            <canvas
              ref={canvasRef}
              className={styles.canvas}
              data-story="canvas"
              aria-hidden="true"
            />
            <PhoneScreen outline={outline} />
            {children}
            <div className={styles.status} aria-hidden="true">
              <span className={styles.statusTime}>{time}</span>
              <span className={styles.signal}>
                {[0, 1, 2, 3].map((k) => (
                  <span key={k} style={{ '--bar': k }} />
                ))}
              </span>
              <span className={styles.battery} />
            </div>
            <div className={styles.progress} aria-hidden="true">
              {CHAPTERS.map((chapter) => (
                <span key={chapter.id} className={styles.segment}>
                  <span className={styles.segmentFill} data-phone="progress" />
                </span>
              ))}
            </div>
          </div>
          <img className={styles.photo} src={handPhoto} alt="" draggable="false" />
        </div>
      </div>
    </div>
  );
}
