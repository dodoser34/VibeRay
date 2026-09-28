import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useNavigationInterceptor, useTransitionNavigate } from '@/app/transitions/useTransition';
import { useViewport, WIDE_QUERY } from '@/adaptations/core';
import { AuthPanel } from '@/features/auth';
import { FrontLayer, HeroCanvas } from '@/features/hero';
import { useCityData } from '@/features/map';
import { gsap, ScrollTrigger, useGSAP } from '@/shared/animations/gsapSetup';
import { usePageEntered } from '@/shared/hooks/usePageEntered';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import home from '@/texts/ru/home.json';
import styles from './HomePage.module.css';

const CITY = 'kostanay';
const FALLBACK_DISTRICT = 'center';

export function HomePage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const go = useTransitionNavigate();
  const mode = pathname === '/register' ? 'register' : 'login';
  const { city, moods } = useCityData(CITY, 'day');
  const entered = usePageEntered();
  const { compact } = useViewport();

  const pageRef = useRef(null);
  const heroRef = useRef(null);
  const sceneLayerRef = useRef(null);
  const passRef = useRef(null);
  const columnRef = useRef(null);
  const layerRef = useRef(null);
  const fadeRef = useRef(null);
  const pinRef = useRef(null);
  const leavingRef = useRef(false);
  const [pinAvatar, setPinAvatar] = useState('preset:0');

  const districts = useMemo(
    () =>
      city.data?.districts.features.map((f) => ({
        slug: f.properties.slug,
        name: f.properties.name,
      })) ?? [],
    [city.data],
  );

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // «В город»: интерфейс гаснет, камера опускается на город, затем переход к карте.
  const flyIntoCity = useCallback(async () => {
    leavingRef.current = true;
    ScrollTrigger.getAll().forEach((trigger) => trigger.disable(false));
    gsap.to([columnRef.current, layerRef.current], {
      autoAlpha: 0,
      x: -40,
      duration: 0.5,
      ease: 'power2.in',
    });
    await heroRef.current?.flyIntoCity({ duration: 1.5 });
    await gsap.to(fadeRef.current, { autoAlpha: 1, duration: 0.35, ease: 'power1.in' });
  }, []);

  useNavigationInterceptor(
    useCallback((to) => (to.startsWith('/map') ? flyIntoCity() : null), [flyIntoCity]),
  );

  // Десктоп: прокрутка вниз ведёт тот же полёт камеры, затем открывает карту.
  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add(WIDE_QUERY, () => {
        ScrollTrigger.create({
          trigger: pageRef.current,
          start: 'top+=60 top', // маленькая случайная прокрутка (например, при фокусе на поле) ничего не делает
          end: 'bottom bottom',
          scrub: 0.6,
          onUpdate: ({ progress }) => {
            if (leavingRef.current) return;
            heroRef.current?.setFlyProgress(progress);
            gsap.set(columnRef.current, { autoAlpha: 1 - progress * 2.4, x: -progress * 90 });
            gsap.set(layerRef.current, { autoAlpha: 1 - progress * 1.6, yPercent: progress * 30 });
          },
          onLeave: () => {
            if (leavingRef.current) return;
            leavingRef.current = true;
            gsap.to(fadeRef.current, {
              autoAlpha: 1,
              duration: 0.35,
              onComplete: () => navigate(`/map/${CITY}`),
            });
          },
        });
      });
      return () => media.revert();
    },
    { scope: pageRef },
  );

  // Появление заголовка — только когда страница видна (после перехода страницы, если он был).
  useGSAP(
    () => {
      if (!entered) return;
      // Широкие экраны: заголовок лежит на переднем листе, поэтому ждёт, пока лист натечёт.
      gsap.from('[data-reveal]', {
        y: 20,
        autoAlpha: 0,
        duration: 0.9,
        ease: 'expo.out',
        stagger: 0.08,
        delay: window.matchMedia(WIDE_QUERY).matches ? 1.5 : 0.35,
      });
    },
    { scope: pageRef, dependencies: [entered] },
  );

  const celebrate = async (user, how) => {
    const slug = user.home_district ?? FALLBACK_DISTRICT;
    heroRef.current?.highlightDistrict(slug);

    if (how === 'register') {
      const card = passRef.current.getBoundingClientRect();
      const sceneRect = sceneLayerRef.current.getBoundingClientRect();
      const target = heroRef.current?.districtScreenPosition(slug);
      const start = { x: card.left + card.width / 2, y: card.top + card.height / 2 };
      const end = target
        ? { x: target.x + sceneRect.left, y: target.y + sceneRect.top }
        : { x: window.innerWidth * 0.7, y: window.innerHeight * 0.55 };
      setPinAvatar(user.avatar_url);

      await gsap
        .timeline()
        .to(passRef.current, {
          scale: 0.35,
          autoAlpha: 0,
          rotation: -6,
          duration: 0.6,
          ease: 'power3.in',
        })
        .set(
          pinRef.current,
          { x: start.x, y: start.y, xPercent: -50, yPercent: -100, autoAlpha: 1, scale: 0.3 },
          '-=0.15',
        )
        .to(pinRef.current, { scale: 1, duration: 0.35, ease: 'back.out(2)' })
        .to(pinRef.current, { x: end.x, duration: 1.1, ease: 'power1.inOut' })
        .to(
          pinRef.current,
          {
            keyframes: {
              y: [start.y, Math.min(start.y, end.y) - 180, end.y],
              easeEach: 'sine.inOut',
            },
            duration: 1.1,
          },
          '<',
        )
        .to(pinRef.current, { scale: 0.2, autoAlpha: 0, duration: 0.25, ease: 'power2.in' })
        .add(() => heroRef.current?.flashDistrict(slug));
      await gsap.to({}, { duration: 0.9 });
    } else {
      heroRef.current?.flashDistrict(slug);
      await gsap.to({}, { duration: 0.6 });
    }
    go(`/map/${CITY}/district/${slug}`);
  };

  return (
    <div ref={pageRef} className={styles.page} data-ui="home-page">
      <div className={styles.stage} data-ui="home-stage">
        <div ref={sceneLayerRef} className={styles.sceneLayer} data-ui="home-scene">
          <HeroCanvas ref={heroRef} city={city.data} moods={moods.data} stacked={compact} />
        </div>
        <div ref={layerRef} className={styles.frontLayer} data-ui="home-front">
          <FrontLayer />
        </div>

        <div className={styles.content} data-ui="home-content">
          <div ref={columnRef} className={styles.column} data-ui="home-column">
            <div className={styles.intro}>
              <p className={styles.eyebrow} data-reveal>
                <span className={styles.liveDot} aria-hidden="true" />
                {home.eyebrow}
              </p>
              <h1 className={styles.title} data-reveal>
                {home.title}
              </h1>
              <p className={styles.lead} data-reveal data-ui="home-lead">
                {home.lead}
              </p>
              {/* В раскладке в одну колонку нет полёта по прокрутке и вкладки карты на экране */}
              <Button
                className={styles.mapCta}
                data-ui="home-map-cta"
                data-reveal
                onClick={() => go(`/map/${CITY}`)}
              >
                {home.openMap}
              </Button>
            </div>
            <AuthPanel
              ref={passRef}
              mode={mode}
              onModeChange={(next) => navigate(next === 'register' ? '/register' : '/login')}
              districts={districts}
              onDistrictPreview={(slug) => heroRef.current?.highlightDistrict(slug)}
              onAuthenticated={celebrate}
            />
          </div>
        </div>

        <button
          type="button"
          className={styles.scrollHint}
          data-ui="home-scroll-hint"
          onClick={() => go(`/map/${CITY}`)}
        >
          <span className={styles.mouse} aria-hidden="true" />
          {home.scrollHint}
        </button>
      </div>

      <div ref={pinRef} className={styles.pin} aria-hidden="true">
        <svg viewBox="0 0 48 60" width="48" height="60">
          <path
            d="M24 58S4 36 4 22a20 20 0 0 1 40 0c0 14-20 36-20 36z"
            className={styles.pinShape}
          />
        </svg>
        <span className={styles.pinAvatar}>
          <Avatar src={pinAvatar} size={26} />
        </span>
      </div>

      <div ref={fadeRef} className={styles.fade} aria-hidden="true" />
    </div>
  );
}
