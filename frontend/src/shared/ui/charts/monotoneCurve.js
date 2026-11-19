// Монотонная кубическая кривая (Фритч–Карлсон): гладкая, но никогда не выходит за данные, поэтому у
// спокойной недели нет ложных горбов. Одна точка становится кружком (круглое окончание линии).
export function curve(points) {
  const [x0, y0] = points[0];
  if (points.length === 1) return `M${x0} ${y0}h0.01`;
  const n = points.length;
  const slopes = [];
  for (let i = 0; i < n - 1; i++) {
    slopes.push((points[i + 1][1] - points[i][1]) / (points[i + 1][0] - points[i][0]));
  }
  const tangents = points.map((_, i) => {
    if (i === 0) return slopes[0];
    if (i === n - 1) return slopes[n - 2];
    return slopes[i - 1] * slopes[i] <= 0 ? 0 : (slopes[i - 1] + slopes[i]) / 2;
  });
  slopes.forEach((slope, i) => {
    if (slope === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
      return;
    }
    const a = tangents[i] / slope;
    const b = tangents[i + 1] / slope;
    const length = a * a + b * b;
    if (length > 9) {
      const k = 3 / Math.sqrt(length);
      tangents[i] = k * a * slope;
      tangents[i + 1] = k * b * slope;
    }
  });
  let d = `M${x0.toFixed(1)} ${y0.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const [xa, ya] = points[i];
    const [xb, yb] = points[i + 1];
    const third = (xb - xa) / 3;
    d +=
      `C${(xa + third).toFixed(1)} ${(ya + tangents[i] * third).toFixed(1)} ` +
      `${(xb - third).toFixed(1)} ${(yb - tangents[i + 1] * third).toFixed(1)} ` +
      `${xb.toFixed(1)} ${yb.toFixed(1)}`;
  }
  return d;
}

// Отрезки ненулевых значений: точка без данных разрывает линию, а не придумывает значение.
export function runs(values, x, y) {
  const result = [];
  let current = [];
  values.forEach((value, i) => {
    if (value === null) {
      if (current.length) result.push(current);
      current = [];
    } else current.push([x(i), y(value)]);
  });
  if (current.length) result.push(current);
  return result;
}
