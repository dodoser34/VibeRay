import { at, story } from './chapters';

// Тайминги сюжета экрана внутри главы «поиск» (в единицах шкалы главы). На мониторе ПК подпись
// главы стоит в стороне, поэтому идеи всплывают сразу. На телефоне подпись главы занимает низ
// экрана — идеи начинаются после того, как её прочли и она ушла, и всё остальное идёт плотнее.
export const SCREEN_TIMING = {
  room: {
    ideas: 0.3,
    step: 0.7,
    strike: 0.8,
    dim: 4.4,
    note: 4.6,
    type: 5,
    typeDuration: 2.4,
    map: 7.6,
    mapDuration: 1.3,
  },
  phone: {
    ideas: 3.9,
    step: 0.36,
    strike: 4.2,
    dim: 6.2,
    note: 6.3,
    type: 6.5,
    typeDuration: 1.7,
    map: 8.25,
    mapDuration: 0.95,
  },
};

// Экран, на котором родилась идея, — монитор в комнате (ПК) или телефон в руке. Разметка у них
// своя, а сюжет общий и размечен data-screen: всплывают идеи и зачёркиваются, печатается вопрос,
// экран занимает карта города — с неё начинается 3D-город.
export function addScreenTimeline(tl, q, timing = SCREEN_TIMING.room) {
  const all = (name) => q(`[data-screen="${name}"]`);

  // Идея въезжает сдвигом, без масштаба: масштаб от центра карточки оставлял на мониторе остаточный
  // сдвиг (центр менялся, когда подпись ужималась по ширине), и карточки наезжали на отметки строк.
  all('idea').forEach((idea, k) => {
    tl.fromTo(
      idea,
      { autoAlpha: 0, x: -10 },
      { autoAlpha: 1, x: 0, duration: 0.6, ease: 'power2.out' },
      at(1, timing.ideas + k * timing.step),
    );
  });
  all('strike').forEach((line, k) => {
    tl.fromTo(
      line,
      { scaleX: 0 },
      { scaleX: 1, transformOrigin: '0% 50%', duration: 0.45, ease: 'power2.out' },
      at(1, timing.strike + k * timing.step),
    );
  });
  tl.to(all('ideas'), { opacity: 0.25, duration: 0.8 }, at(1, timing.dim));

  const notes = all('note');
  if (notes.length) {
    tl.fromTo(
      notes,
      { autoAlpha: 0, y: 12 },
      { autoAlpha: 1, y: 0, duration: 0.6 },
      at(1, timing.note),
    );
  }
  // Вопрос печатается по буквам; текст читается при построении шкалы — её строят заново при смене
  // языка.
  const typed = all('typed');
  const text = story.screenQuestion;
  const typing = { chars: 0 };
  const print = () => {
    const shown = text.slice(0, Math.round(typing.chars));
    typed.forEach((node) => {
      node.textContent = shown;
    });
  };
  print();
  tl.to(
    typing,
    { chars: text.length, duration: timing.typeDuration, ease: 'none', onUpdate: print },
    at(1, timing.type),
  );

  tl.fromTo(
    all('map'),
    { autoAlpha: 0 },
    { autoAlpha: 1, duration: timing.mapDuration },
    at(1, timing.map),
  );
  return tl;
}
