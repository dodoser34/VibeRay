const normalize = (text) => text.toLowerCase().replace(/ё/g, 'е');
const words = (text) => normalize(text).match(/[a-zа-я0-9]+/g) ?? [];
// В русском окончания меняются («район», «района», «районы»): сравниваем по основе.
const stem = (word) => (word.length > 4 ? word.slice(0, word.length - 2) : word);

// Ранжирует записи FAQ по числу слов запроса, которые в них есть (слова вопроса считаются дважды).
export function searchHelp(faq, query, limit = 5) {
  const terms = words(query).map(stem);
  if (!terms.length) return [];
  const ranked = faq
    .map((item) => {
      const question = words(item.question);
      const rest = words(`${item.answer} ${item.keywords}`);
      const score = terms.reduce((sum, term) => {
        if (question.some((word) => word.startsWith(term))) return sum + 2;
        if (rest.some((word) => word.startsWith(term))) return sum + 1;
        return sum;
      }, 0);
      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);
  // Отбрасываем слабый хвост: ответ, совпавший с одним словом из четырёх, — шум рядом с полным
  // совпадением.
  const best = ranked[0]?.score ?? 0;
  return ranked
    .filter(({ score }) => score * 2 >= best)
    .slice(0, limit)
    .map(({ item }) => item);
}
