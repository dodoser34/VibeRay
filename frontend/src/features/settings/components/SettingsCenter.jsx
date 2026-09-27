import { useEffect, useRef, useState } from 'react';
import { gsap, SplitText, useGSAP } from '@/shared/animations/gsapSetup';
import { revealOnScroll } from '@/shared/animations/revealOnScroll';
import { usePageEntered } from '@/shared/hooks/usePageEntered';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { AccountSection } from './AccountSection';
import { DistrictSection } from './DistrictSection';
import { ProfileSection } from './ProfileSection';
import { SecuritySection } from './SecuritySection';
import texts from '@/texts/settings.json';
import styles from './SettingsCenter.module.css';

const SECTIONS = ['profile', 'district', 'security', 'account'].map((key) => ({
  key,
  id: `settings-${key}`,
  label: texts.sections[key],
  short: texts.sectionsShort[key],
}));

// Страница настроек: навигация по разделам (подсвечивает раздел, который сейчас на экране)
// и сами разделы. districts: [{ slug, name }] или null, пока город грузится.
export function SettingsCenter({ districts, onLogout, onDeleted }) {
  const rootRef = useRef(null);
  const reduced = useReducedMotion();
  const entered = usePageEntered();
  const [active, setActive] = useState(SECTIONS[0].id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length) setActive(visible[0].target.id);
      },
      // Раздел считается текущим, когда пересекает полосу чуть выше середины экрана.
      { rootMargin: '-35% 0px -60% 0px' },
    );
    SECTIONS.forEach(({ id }) => observer.observe(document.getElementById(id)));
    return () => observer.disconnect();
  }, []);

  useGSAP(
    (context, contextSafe) => {
      if (reduced || !entered) return undefined;
      const split = SplitText.create('[data-title]', { type: 'words', mask: 'words' });
      gsap
        .timeline({ defaults: { ease: 'power3.out' } })
        .from(split.words, { yPercent: 110, duration: 0.9, stagger: 0.08 }, 0.1)
        .from('[data-hero]', { y: 20, autoAlpha: 0, duration: 0.7, stagger: 0.08 }, 0.3)
        .from('[data-nav-item]', { x: -16, autoAlpha: 0, duration: 0.6, stagger: 0.06 }, 0.35);
      return revealOnScroll(gsap.utils.toArray('[data-rise]'), { contextSafe, share: 0.08 });
    },
    { scope: rootRef, dependencies: [reduced, entered], revertOnUpdate: true },
  );

  const jumpTo = (id) => (event) => {
    event.preventDefault();
    document
      .getElementById(id)
      .scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    setActive(id);
  };

  return (
    <div ref={rootRef} className={styles.center} data-ui="settings-page">
      <header className={styles.hero}>
        <p className={styles.kicker} data-hero>
          {texts.kicker}
        </p>
        <h1 className={styles.title} data-title>
          {texts.title}
        </h1>
        <p className={styles.lead} data-hero>
          {texts.lead}
        </p>
      </header>

      <div className={styles.layout} data-ui="settings-layout">
        <nav className={styles.nav} aria-label={texts.navLabel} data-ui="settings-nav">
          <ul className={styles.navList}>
            {SECTIONS.map(({ id, label, short }) => (
              <li key={id} data-nav-item>
                <a
                  href={`#${id}`}
                  className={styles.navLink}
                  aria-current={active === id ? 'location' : undefined}
                  onClick={jumpTo(id)}
                >
                  <span data-ui="settings-nav-full">{label}</span>
                  {/* Короткая подпись — для телефона, где четыре раздела должны встать в одну строку */}
                  <span className={styles.short} data-ui="settings-nav-short" aria-hidden="true">
                    {short}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.sections}>
          <ProfileSection id={SECTIONS[0].id} />
          <DistrictSection id={SECTIONS[1].id} districts={districts} />
          <SecuritySection id={SECTIONS[2].id} />
          <AccountSection id={SECTIONS[3].id} onLogout={onLogout} onDeleted={onDeleted} />
        </div>
      </div>
    </div>
  );
}
