"""Таблица результатов проверки: печатается по мере работы, итог — «ПРИНЯТО» или «НЕ ПРИНЯТО»."""

import shapely

OVERLAP_M = 0.1  # наложение (районов друг на друга, на воду, за черту города) не шире этого:
# узлы сети лежат на сетке координат 1e-7° (~1 см), и вдоль общей линии остаются волосяные щепки


class Report:
    def __init__(self, city: str) -> None:
        self.city = city
        self.rows: list[tuple[str, str, str, str, bool | None]] = []

    def add(self, code: str, title: str, measured: str, limit: str, passed: bool | None) -> None:
        """passed=None — справка без порога."""
        self.rows.append((code, title, measured, limit, passed))
        mark = {True: 'OK ', False: 'НЕТ', None: '   '}[passed]
        print(f'  {mark} {code:3} {title}: {measured}' + (f'  [порог: {limit}]' if limit else ''))

    def add_overlap(self, code: str, title: str, overlaps: list) -> None:
        """Наложение засчитывается, если оно где-то шире OVERLAP_M (не исчезает при сжатии)."""
        area = sum(piece.area for piece in overlaps)
        wide = sum(not shapely.buffer(piece, -OVERLAP_M / 2).is_empty for piece in overlaps)
        measured = f'{wide} мест шире {OVERLAP_M} м (волосяных щепок на {area:.2f} м²)'
        self.add(code, title, measured, f'нигде не шире {OVERLAP_M} м', wide == 0)

    @property
    def accepted(self) -> bool:
        return all(passed is not False for *_, passed in self.rows)
