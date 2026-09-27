import districtsRaw from '../cities/kostanay/districts.geojson?raw';
import waterRaw from '../cities/kostanay/water.geojson?raw';
import streetsRaw from '../cities/kostanay/streets.geojson?raw';
import cityInfo from '../cities/kostanay/city.json';
import { MOODS, MOOD_BY_CODE } from '@/shared/config/moods';
import { PROBLEM_CATEGORIES } from '@/shared/config/problemCategories';
import { largestRing, pointInRing } from '@/shared/lib/geoProjection';
import { createRandom, hashString } from '@/shared/lib/random';
import { format } from '@/shared/lib/format';
import demo from '../content.json';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const YEAR = 365.25 * DAY;
const MIN_SAMPLE = 5; // порог приватности, ARCHITECTURE.md 6.1
// Демо-история: город в VibeRay с января 2023 года.
const HISTORY_START = new Date(2023, 0, 1).getTime();

const districtsGeo = JSON.parse(districtsRaw);

const BASE_SCORE = {
  center: 0.9,
  vokzal: -0.4,
  narimanovka: 0.3,
  zapadny: 0.5,
  kzhbi: 1.1,
  khimik: -0.8,
  amangeldy: -0.2,
  dostyk: 0.6,
  'kostanay-2': 0.8,
  aeroport: 0.1,
  perevalovka: -0.5,
  ksk: 0.2,
  zelenstroy: 0.7,
  'uzkaya-koleya': -0.9,
};

// Интервалы ряда динамики (ARCHITECTURE.md 6.3) и типичное число отметок на район; для `all` — 14
// 000 отметок на год истории.
const PERIODS = {
  day: { unit: HOUR, points: 24, sample: 240 },
  week: { unit: DAY, points: 7, sample: 280 },
  month: { unit: DAY, points: 30, sample: 1150 },
  year: { unit: 'month', points: 12, sample: 14000 },
  all: { unit: 'month', sample: 14000 },
};

const DESCRIPTIONS = demo.problemDescriptions;

const userMarks = []; // { userId, district, mood, at }

export const city = {
  slug: cityInfo.slug,
  name: cityInfo.name,
  center: cityInfo.center,
  bbox: cityInfo.bbox,
  timezone: cityInfo.timezone,
  // Слои OpenStreetMap (ODbL): реки и водоёмы, улицы с привязкой к району.
  water: JSON.parse(waterRaw),
  streets: JSON.parse(streetsRaw),
  districts: {
    type: 'FeatureCollection',
    features: districtsGeo.features.map((feature) => ({
      ...feature,
      id: feature.properties.slug,
    })),
  },
};

const districtSlugs = city.districts.features.map((f) => f.properties.slug);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

const round2 = (value) => Math.round(value * 100) / 100;

// [start, end) каждого интервала, от старых к новым. Часы и дни выровнены по часам (последний
// интервал — текущий, незавершённый); месяцы — календарные (как date_trunc в SQL).
function bucketsFor(period, now = Date.now()) {
  const cfg = PERIODS[period];
  if (cfg.unit !== 'month') {
    const base = new Date(now);
    if (cfg.unit === HOUR) base.setMinutes(0, 0, 0);
    else base.setHours(0, 0, 0, 0);
    return Array.from({ length: cfg.points }, (_, i) => {
      const start = base.getTime() - (cfg.points - 1 - i) * cfg.unit;
      return [start, Math.min(start + cfg.unit, now)];
    });
  }
  const today = new Date(now);
  const first =
    period === 'all'
      ? new Date(HISTORY_START)
      : new Date(today.getFullYear(), today.getMonth() - (cfg.points - 1), 1);
  const buckets = [];
  const year = first.getFullYear();
  for (let month = first.getMonth(); ; month++) {
    const start = new Date(year, month, 1).getTime();
    if (start > now) break;
    buckets.push([start, Math.min(new Date(year, month + 1, 1).getTime(), now)]);
  }
  return buckets;
}

function sampleFor(period, buckets) {
  if (period !== 'all') return PERIODS[period].sample;
  return Math.round((buckets.length / 12) * PERIODS.all.sample);
}

function distributionFor(score, sample, rand) {
  const weights = MOODS.map((mood) => Math.exp(-((mood.score - score) ** 2) / 0.9) + rand() * 0.05);
  const total = weights.reduce((a, b) => a + b, 0);
  const counts = weights.map((w) => Math.round((w / total) * sample));
  return Object.fromEntries(MOODS.map((mood, i) => [mood.code, counts[i]]));
}

// Настроение в начале ряда против конца: среднее трёх последних точек минус трёх первых.
function trendOf(series) {
  const scored = series.filter((point) => point.score !== null);
  if (scored.length < 4) return 0;
  const mean = (points) => points.reduce((sum, p) => sum + p.score, 0) / points.length;
  return round2(mean(scored.slice(-3)) - mean(scored.slice(0, 3)));
}

function problemsIn(list, start, end) {
  return list.filter((p) => {
    const t = new Date(p.created_at).getTime();
    return t >= start && t < end;
  });
}

// Динамика одного района: оценка настроения, число отметок и новых проблем по интервалам. У
// интервала с числом отметок меньше порога приватности оценки нет.
function seriesFor(slug, period) {
  const buckets = bucketsFor(period);
  const monthly = PERIODS[period].unit === 'month';
  const rand = createRandom(hashString(`series:${slug}:${period}`));
  const phase = rand() * Math.PI * 2;
  const drift = (rand() - 0.35) * 0.3; // изменение оценки за год: большинство районов медленно улучшается
  // Аэропорт ночью тихий: демонстрация порога приватности за день.
  const quiet = slug === 'aeroport' && period === 'day';
  const perBucket = quiet ? 0.15 : sampleFor(period, buckets) / buckets.length;
  const inDistrict = problems.filter((p) => p.district === slug);
  const now = Date.now();

  return buckets.map(([start, end], i) => {
    const wave = monthly
      ? Math.sin(((new Date(start).getMonth() - 3) / 12) * Math.PI * 2) * 0.35 // летом добрее
      : Math.sin((i / buckets.length) * Math.PI * 2 + phase) * 0.45;
    const score = clamp(
      BASE_SCORE[slug] + wave + (drift * (start - now)) / YEAR + (rand() - 0.5) * 0.4,
      -2,
      2,
    );
    const full = monthly ? 30.44 * DAY : PERIODS[period].unit;
    const marks = Math.round(perBucket * (0.6 + rand() * 0.8) * Math.min(1, (end - start) / full));
    return {
      t: new Date(start).toISOString(),
      score: marks >= MIN_SAMPLE ? round2(score) : null,
      marks,
      problems: problemsIn(inDistrict, start, end).length,
    };
  });
}

function aggregate(slug, period, series = seriesFor(slug, period)) {
  const rand = createRandom(hashString(`${slug}:${period}`));
  const scored = series.filter((point) => point.score !== null);
  let sample = series.reduce((sum, point) => sum + point.marks, 0);
  let score = scored.length
    ? scored.reduce((sum, p) => sum + p.score * p.marks, 0) /
      Math.max(
        1,
        scored.reduce((sum, p) => sum + p.marks, 0),
      )
    : BASE_SCORE[slug];
  const distribution = distributionFor(score, sample, rand);

  const since = bucketsFor(period)[0][0];
  userMarks
    .filter((mark) => mark.district === slug && mark.at >= since)
    .forEach((mark) => {
      score = (score * sample + MOOD_BY_CODE[mark.mood].score) / (sample + 1);
      sample += 1;
      distribution[mark.mood] += 1;
    });

  if (sample < MIN_SAMPLE) return { insufficient_data: true, sample_size: sample };
  const dominant = Object.entries(distribution).sort((a, b) => b[1] - a[1])[0][0];
  return {
    insufficient_data: false,
    score: round2(score),
    dominant_mood: dominant,
    distribution,
    sample_size: sample,
  };
}

export function cityMoods(period) {
  return {
    period,
    updated_at: new Date().toISOString(),
    districts: Object.fromEntries(districtSlugs.map((slug) => [slug, aggregate(slug, period)])),
  };
}

function randomPointIn(feature, rand) {
  const ring = largestRing(feature.geometry.coordinates);
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ];
  for (let attempt = 0; attempt < 200; attempt++) {
    const point = [minX + rand() * (maxX - minX), minY + rand() * (maxY - minY)];
    if (pointInRing(point, ring)) return point;
  }
  return ring[0];
}

function pickWeighted(rand, entries) {
  let roll = rand();
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

function makeProblem(rand, id, statuses, createdAt, avatar) {
  const feature = city.districts.features[Math.floor(rand() * city.districts.features.length)];
  const category = PROBLEM_CATEGORIES[Math.floor(rand() * PROBLEM_CATEGORIES.length)].code;
  const status = pickWeighted(rand, statuses);
  const confirmations = status === 'new' ? Math.floor(rand() * 3) : 3 + Math.floor(rand() * 40);
  return {
    id,
    district: feature.properties.slug,
    category,
    status,
    description: DESCRIPTIONS[category],
    location: randomPointIn(feature, rand),
    confirmations_count: confirmations,
    created_at: new Date(createdAt(rand)).toISOString(),
    author: {
      nickname: format(demo.residentNickname, { number: 100 + Math.floor(rand() * 900) }),
      avatar_url: `preset:${avatar}`,
    },
  };
}

// Последний месяц оживлённый; старые сообщения с 2023 года в основном решены (всё старше года —
// решено). Сообщений больше с ростом числа жителей, поэтому история смещена к последним годам.
export const problems = (() => {
  const now = Date.now();
  const recentRand = createRandom(20260924);
  const recent = Array.from({ length: 64 }, (_, i) =>
    makeProblem(
      recentRand,
      `p${i + 1}`,
      [
        ['new', 0.35],
        ['confirmed', 0.3],
        ['in_progress', 0.2],
        ['resolved', 0.15],
      ],
      (rand) => now - rand() ** 1.6 * 30 * DAY,
      i % 8,
    ),
  );
  const historyRand = createRandom(20230101);
  const historySpan = now - 30 * DAY - HISTORY_START;
  const history = Array.from({ length: 1100 }, (_, i) => {
    const createdAt = HISTORY_START + historyRand() ** 0.6 * historySpan;
    const statuses =
      now - createdAt > 365 * DAY
        ? [['resolved', 1]]
        : [
            ['confirmed', 0.04],
            ['in_progress', 0.06],
            ['resolved', 0.9],
          ];
    return makeProblem(historyRand, `h${i + 1}`, statuses, () => createdAt, i % 8);
  });
  return [...recent, ...history];
})();

export function districtStats(slug, period) {
  const series = seriesFor(slug, period);
  const since = bucketsFor(period)[0][0];
  const inDistrict = problems.filter((p) => p.district === slug);
  const inPeriod = problemsIn(inDistrict, since, Infinity);

  const byStatus = { new: 0, confirmed: 0, in_progress: 0, resolved: 0 };
  inDistrict.forEach((p) => (byStatus[p.status] += 1));

  const byCategory = {};
  inDistrict.forEach((p) => (byCategory[p.category] = (byCategory[p.category] ?? 0) + 1));
  const topCategories = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, count]) => ({ category, count }));
  // Все категории за выбранный период — для сравнения районов на дашборде.
  const periodByCategory = {};
  inPeriod.forEach((p) => (periodByCategory[p.category] = (periodByCategory[p.category] ?? 0) + 1));

  return {
    district: slug,
    period,
    mood: aggregate(slug, period, series),
    problems: {
      total: inDistrict.length,
      new_in_period: inPeriod.length,
      active: inDistrict.length - byStatus.resolved,
      by_status: byStatus,
    },
    top_categories: topCategories,
    categories: Object.entries(periodByCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({ category, count })),
    series,
    recent_problems: [...inDistrict]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 3),
  };
}

// Дашборд города: весь город и каждый район за один период (ARCHITECTURE.md 6.4).
export function cityStats(period) {
  const buckets = bucketsFor(period);
  const since = buckets[0][0];
  const inPeriod = problemsIn(problems, since, Infinity);

  const rows = districtSlugs.map((slug) => {
    const series = seriesFor(slug, period);
    const mood = aggregate(slug, period, series);
    const reported = inPeriod.filter((p) => p.district === slug);
    return {
      series,
      row: {
        district: slug,
        mood,
        trend: mood.insufficient_data ? null : trendOf(series),
        problems: {
          reported: reported.length,
          resolved: reported.filter((p) => p.status === 'resolved').length,
        },
      },
    };
  });

  const series = buckets.map(([start], i) => {
    const points = rows.map(({ series: districtSeries }) => districtSeries[i]);
    const scored = points.filter((point) => point.score !== null);
    const scoredMarks = scored.reduce((sum, p) => sum + p.marks, 0);
    const marks = points.reduce((sum, p) => sum + p.marks, 0);
    return {
      t: new Date(start).toISOString(),
      score:
        marks >= MIN_SAMPLE && scoredMarks
          ? round2(scored.reduce((sum, p) => sum + p.score * p.marks, 0) / scoredMarks)
          : null,
      marks,
      problems: points.reduce((sum, p) => sum + p.problems, 0),
    };
  });

  const moods = rows.map(({ row }) => row.mood).filter((mood) => !mood.insufficient_data);
  const scoredSample = moods.reduce((sum, mood) => sum + mood.sample_size, 0);
  const distribution = Object.fromEntries(
    MOODS.map((mood) => [mood.code, moods.reduce((sum, m) => sum + m.distribution[mood.code], 0)]),
  );
  const byStatus = { new: 0, confirmed: 0, in_progress: 0, resolved: 0 };
  inPeriod.forEach((p) => (byStatus[p.status] += 1));
  const byCategory = {};
  inPeriod.forEach((p) => (byCategory[p.category] = (byCategory[p.category] ?? 0) + 1));

  return {
    city: city.slug,
    period,
    since: new Date(since).toISOString(),
    updated_at: new Date().toISOString(),
    mood: scoredSample
      ? {
          insufficient_data: false,
          score: round2(moods.reduce((sum, m) => sum + m.score * m.sample_size, 0) / scoredSample),
          dominant_mood: Object.entries(distribution).sort((a, b) => b[1] - a[1])[0][0],
          distribution,
          sample_size: rows.reduce((sum, { row }) => sum + row.mood.sample_size, 0),
        }
      : { insufficient_data: true, sample_size: 0 },
    trend: trendOf(series),
    problems: {
      reported: inPeriod.length,
      active: inPeriod.length - byStatus.resolved,
      by_status: byStatus,
    },
    categories: Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({ category, count })),
    series,
    districts: rows.map(({ row }) => row),
  };
}

export function addMoodMark(userId, district, mood) {
  const previous = userMarks.findIndex(
    (m) => m.userId === userId && m.district === district && Date.now() - m.at < 3 * HOUR,
  );
  if (previous !== -1) userMarks.splice(previous, 1);
  userMarks.push({ userId, district, mood, at: Date.now() });
}

export function isDistrict(slug) {
  return districtSlugs.includes(slug);
}

// Район, в который попадает точка (на сервере это PostGIS ST_Contains).
export function districtAt(location) {
  const feature = city.districts.features.find((f) =>
    f.geometry.coordinates.some(
      ([outer, ...holes]) =>
        pointInRing(location, outer) && !holes.some((hole) => pointInRing(location, hole)),
    ),
  );
  return feature?.properties.slug ?? null;
}

export function addProblem({ author, district, category, description, location, photos }) {
  const problem = {
    id: `p${problems.length + 1}-${Date.now().toString(36)}`,
    district,
    category,
    status: 'new',
    description,
    location,
    confirmations_count: 0,
    created_at: new Date().toISOString(),
    author: { nickname: author.nickname, avatar_url: author.avatar_url },
    photos,
  };
  problems.push(problem);
  return problem;
}
