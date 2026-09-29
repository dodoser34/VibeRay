import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { gsap, SplitText, useGSAP } from '@/shared/animations/gsapSetup';
import { revealOnScroll } from '@/shared/animations/revealOnScroll';
import { usePageEntered } from '@/shared/hooks/usePageEntered';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { Button } from '@/shared/ui/Button';
import { FAQ, HELP_CATEGORIES } from '../content';
import { searchHelp } from '../lib/searchHelp';
import { FaqList } from './FaqList';
import { HelpCategories } from './HelpCategories';
import { HelpSearch } from './HelpSearch';
import { ServiceStatus } from './ServiceStatus';
import { SupportRequestForm } from './SupportRequestForm';
import texts from '@/texts/ru/support.json';
import { useLanguage } from '@/shared/hooks/useLanguage';
import styles from './SupportCenter.module.css';

const LINKS = [
  {
    to: '/map/kostanay',
    get label() {
      return texts.footer.links.map;
    },
  },
  {
    to: '/about',
    get label() {
      return texts.footer.links.about;
    },
  },
  {
    to: '/login',
    get label() {
      return texts.footer.links.login;
    },
  },
  {
    to: '/register',
    get label() {
      return texts.footer.links.register;
    },
  },
];

// Страница поддержки: поиск → темы → ответы → «не нашли?» → статус сервисов → контакты.
export function SupportCenter({ onNavigate }) {
  const language = useLanguage();
  const rootRef = useRef(null);
  const faqRef = useRef(null);
  const reduced = useReducedMotion();
  const entered = usePageEntered();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [form, setForm] = useState(null); // { topic }, пока открыта форма обращения

  // Без useMemo: поиск дешёвый, а ответы FAQ меняются на месте при смене языка.
  const results = searchHelp(FAQ, query);

  // Цель может появиться только после отрисовки отфильтрованного списка: сначала коммит, потом
  // прокрутка.
  const showInFaq = (update, getTarget) => {
    flushSync(update);
    getTarget()?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  };

  const pickAnswer = (item) =>
    showInFaq(
      () => {
        setQuery('');
        setCategory(null);
        setOpenId(item.id);
      },
      () => document.getElementById(`q-${item.id}`),
    );

  const selectCategory = (code) =>
    showInFaq(
      () => {
        setCategory(code);
        setOpenId(null);
      },
      () => faqRef.current,
    );

  const openForm = () =>
    setForm({ topic: HELP_CATEGORIES.find((c) => c.code === category)?.topic ?? null });

  useGSAP(
    (context, contextSafe) => {
      // Появление шапки ждёт, пока страница видна (после перехода страницы, если он был).
      if (reduced || !entered) return undefined;
      const split = SplitText.create('[data-title]', { type: 'words', mask: 'words' });
      gsap
        .timeline({ defaults: { ease: 'power3.out' } })
        .from(split.words, { yPercent: 110, duration: 0.9, stagger: 0.08 }, 0.15)
        .from('[data-hero]', { y: 24, autoAlpha: 0, duration: 0.8, stagger: 0.1 }, 0.4)
        .from(
          '[data-deck-card]',
          { y: 60, rotateX: 30, autoAlpha: 0, duration: 1.1, stagger: 0.12 },
          0.3,
        );
      // Секции и футер поднимаются при попадании в зону видимости, при любой высоте экрана.
      const stopReveal = revealOnScroll(gsap.utils.toArray('[data-rise]'), { contextSafe });

      // Колода карточек наклоняется за указателем (3D-параллакс, спокойный и медленный).
      const deck = rootRef.current.querySelector('[data-deck]');
      if (!deck) return stopReveal;
      const rotateY = gsap.quickTo(deck, 'rotateY', { duration: 1.2, ease: 'power3.out' });
      const rotateX = gsap.quickTo(deck, 'rotateX', { duration: 1.2, ease: 'power3.out' });
      const onMove = contextSafe((event) => {
        rotateY((event.clientX / window.innerWidth - 0.5) * 16);
        rotateX(-(event.clientY / window.innerHeight - 0.5) * 12);
      });
      window.addEventListener('pointermove', onMove);
      return () => {
        window.removeEventListener('pointermove', onMove);
        stopReveal();
      };
    },
    { scope: rootRef, dependencies: [reduced, entered], revertOnUpdate: true },
  );

  return (
    <div ref={rootRef} className={styles.center} data-ui="support-page">
      <header className={styles.hero} data-ui="support-hero">
        <div className={styles.heroText}>
          <p className={styles.kicker} data-hero>
            {texts.hero.kicker}
          </p>
          <h1 key={language} className={styles.title} data-title>
            {texts.hero.title}
          </h1>
          <p className={styles.lead} data-hero>
            {texts.hero.lead}
          </p>
          <div data-hero className={styles.searchSlot}>
            <HelpSearch
              query={query}
              onQueryChange={setQuery}
              results={results}
              onPick={pickAnswer}
              onWrite={openForm}
            />
          </div>
        </div>

        <div className={styles.deckStage} aria-hidden="true" data-ui="support-deck">
          <div className={styles.deck} data-deck>
            <div className={`${styles.deckCard} ${styles.deckBack}`} data-deck-card>
              <span className={styles.deckKicker}>{texts.deck.statusKicker}</span>
              <span className={styles.deckStatus}>
                <span className={styles.deckDot} />
                {texts.deck.statusValue}
              </span>
            </div>
            <div className={`${styles.deckCard} ${styles.deckMiddle}`} data-deck-card>
              <span className={styles.deckKicker}>{texts.deck.moodKicker}</span>
              <span className={styles.deckMoods}>
                <i style={{ '--mood': 'var(--mood-excellent)' }} />
                <i style={{ '--mood': 'var(--mood-good)' }} />
                <i style={{ '--mood': 'var(--mood-normal)' }} />
                <i style={{ '--mood': 'var(--mood-anxious)' }} />
                <i style={{ '--mood': 'var(--mood-bad)' }} />
              </span>
            </div>
            <div className={`${styles.deckCard} ${styles.deckFront}`} data-deck-card>
              <span className={styles.deckKicker}>{texts.deck.answerKicker}</span>
              <span className={styles.deckQuestion}>{texts.deck.answerQuestion}</span>
              <span className={styles.deckLine} />
              <span className={`${styles.deckLine} ${styles.deckLineShort}`} />
            </div>
          </div>
        </div>
      </header>

      <section className={styles.section} aria-labelledby="help-topics">
        <div className={styles.sectionHead} data-rise>
          <h2 id="help-topics" className={styles.sectionTitle}>
            {texts.categoriesSection.title}
          </h2>
          <p className={styles.sectionText}>{texts.categoriesSection.text}</p>
        </div>
        <div data-rise>
          <HelpCategories active={category} onSelect={selectCategory} />
        </div>
      </section>

      <section ref={faqRef} className={styles.section} aria-labelledby="help-faq">
        <div className={styles.sectionHead} data-rise>
          <h2 id="help-faq" className={styles.sectionTitle}>
            {texts.faqSection.title}
          </h2>
        </div>
        <div data-rise>
          <FaqList
            category={category}
            onCategoryChange={(code) => {
              setCategory(code);
              setOpenId(null);
            }}
            openId={openId}
            onToggle={setOpenId}
          />
        </div>
      </section>

      <section className={styles.bottomGrid} data-ui="support-bottom-grid">
        <div className={styles.cta} data-rise>
          <p className={styles.kicker}>{texts.cta.kicker}</p>
          <h2 className={styles.ctaTitle}>{texts.cta.title}</h2>
          <p className={styles.ctaText}>{texts.cta.text}</p>
          <Button size="lg" onClick={openForm}>
            {texts.cta.button}
          </Button>
        </div>
        <div data-rise>
          <ServiceStatus />
        </div>
      </section>

      <footer className={styles.footer} data-rise>
        <div className={styles.contacts}>
          <p className={styles.footerTitle}>{texts.footer.title}</p>
          <p className={styles.footerText}>{texts.footer.text}</p>
          <button type="button" className={styles.footerAction} onClick={openForm}>
            {texts.footer.openForm}
          </button>
        </div>
        <nav className={styles.links} aria-label={texts.footer.linksLabel}>
          {LINKS.map((link) => (
            <button
              key={link.to}
              type="button"
              className={styles.link}
              onClick={() => onNavigate(link.to)}
            >
              {link.label}
            </button>
          ))}
        </nav>
      </footer>

      {form && <SupportRequestForm initialTopic={form.topic} onClose={() => setForm(null)} />}
    </div>
  );
}
