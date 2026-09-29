import { PROBLEM_STATUSES } from '@/shared/config/problemStatuses';
import { createRandom, hashString } from '@/shared/lib/random';
import { city, problems } from './generate';
import { nameOf } from './locale';

const ORDER = PROBLEM_STATUSES.map((status) => status.code);
const AUTO_CONFIRM_THRESHOLD = 3; // ARCHITECTURE.md 6.2
const MINUTE = 60_000;
// Демо «соседей»: через сколько после отправки новую проблему подтверждают и сколько человек.
const NEIGHBOURS = [
  { after: 25_000, count: 2 },
  { after: 70_000, count: 1 },
];
// Демо-модератор: новое сообщение той же категории в пределах 80 м от ещё не решённой проблемы
// через 40 с отклоняется как дубль со ссылкой на исходную.
const DUPLICATE_RADIUS_M = 80;
const MODERATOR_AFTER = 40_000;

const authors = new Map(); // id проблемы → id автора
const histories = new Map(); // id проблемы → [{ status, changed_at }] (problem_status_changes)
const inbox = new Map(); // id пользователя → уведомления, новые первыми
const timers = new Set();
let lastNotification = 0;

const iso = (time) => new Date(time).toISOString();
const districtName = (slug) => {
  const feature = city.districts.features.find((f) => f.properties.slug === slug);
  return feature ? nameOf(feature.properties) : '';
};

// История восстанавливается из текущего статуса: переходы между датой сообщения и сейчас, стабильно
// для каждой проблемы (на сервере это таблица problem_status_changes).
function historyOf(problem) {
  if (!histories.has(problem.id)) {
    const created = new Date(problem.created_at).getTime();
    const rand = createRandom(hashString(`history:${problem.id}`));
    const steps = [{ status: 'new', changed_at: problem.created_at }];
    let at = created;
    for (let i = 1; i <= ORDER.indexOf(problem.status); i++) {
      at += (Date.now() - at) * (0.25 + rand() * 0.35);
      steps.push({ status: ORDER[i], changed_at: iso(at) });
    }
    histories.set(problem.id, steps);
  }
  return histories.get(problem.id);
}

export const withHistory = (problem) => ({ ...problem, history: historyOf(problem) });

export const isAuthor = (problem, user) => authors.get(problem.id) === user.id;

function notify(userId, { kind, problem, status, count, at = Date.now() }) {
  const list = inbox.get(userId) ?? [];
  lastNotification = Math.max(at, lastNotification + 1);
  list.unshift({
    id: `n${lastNotification.toString(36)}`,
    kind,
    problem_id: problem.id,
    status,
    count,
    created_at: iso(at),
    read: false,
  });
  inbox.set(
    userId,
    list.sort((a, b) => b.created_at.localeCompare(a.created_at)),
  );
}

function setStatus(problem, status, at = Date.now()) {
  historyOf(problem);
  problem.status = status;
  histories.get(problem.id).push({ status, changed_at: iso(at) });
  const author = authors.get(problem.id);
  if (author) notify(author, { kind: 'status', problem, status, at });
}

// Модерация: сообщение уходит с карты и из статистики, автор получает уведомление с причиной.
function reject(problem, reason, duplicateOf, at = Date.now()) {
  problem.rejection_reason = reason;
  if (duplicateOf) problem.duplicate_of = duplicateOf.id;
  setStatus(problem, 'rejected', at);
}

function distanceM([lon1, lat1], [lon2, lat2]) {
  const kx = 111_320 * Math.cos((lat1 * Math.PI) / 180);
  return Math.hypot((lon2 - lon1) * kx, (lat2 - lat1) * 110_540);
}

function originalOf(problem) {
  return problems.find(
    (p) =>
      p !== problem &&
      p.category === problem.category &&
      !['resolved', 'rejected'].includes(p.status) &&
      distanceM(p.location, problem.location) < DUPLICATE_RADIUS_M,
  );
}

// Подтверждение от жителя: счётчик, автоподтверждение по порогу и уведомление автору.
export function addConfirmations(problem, count) {
  problem.confirmations_count += count;
  const author = authors.get(problem.id);
  if (author)
    notify(author, { kind: 'confirmations', problem, count: problem.confirmations_count });
  if (problem.status === 'new' && problem.confirmations_count >= AUTO_CONFIRM_THRESHOLD) {
    setStatus(problem, 'confirmed');
  }
}

export function claimProblem(problem, user) {
  authors.set(problem.id, user.id);
  historyOf(problem);
}

// Демо без сервера: соседи находят новую проблему и подтверждают её, пока автор на сайте. Дубль
// существующей проблемы вместо этого отклоняет модератор.
export function simulateNeighbours(problem) {
  const original = originalOf(problem);
  if (original) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (problems.includes(problem)) reject(problem, 'duplicate', original);
    }, MODERATOR_AFTER);
    timers.add(timer);
    return;
  }
  NEIGHBOURS.forEach(({ after, count }) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (problems.includes(problem)) addConfirmations(problem, count);
    }, after);
    timers.add(timer);
  });
}

// Демо-аккаунт уже сообщал о проблемах: берём свежие проблемы нужных статусов и восстанавливаем, какие
// уведомления он получал (прочитаны все, кроме двух последних).
export function seedReports(user, statuses) {
  const taken = new Set();
  statuses.forEach((status) => {
    const source = status === 'rejected' ? 'new' : status;
    const problem = problems.find(
      (p) => p.id.startsWith('p') && p.status === source && !authors.has(p.id) && !taken.has(p.id),
    );
    if (!problem) return;
    taken.add(problem.id);
    claimProblem(problem, user);
    problem.author = { nickname: user.nickname, avatar_url: user.avatar_url };
    if (status === 'rejected') {
      // Дубль уже известной проблемы, о которой сообщили раньше: то же место и та же категория
      const original = problems.find(
        (p) =>
          p !== problem &&
          ['confirmed', 'in_progress'].includes(p.status) &&
          p.created_at < problem.created_at,
      );
      if (original) {
        Object.assign(problem, {
          category: original.category,
          description: original.description,
          district: original.district,
          location: [original.location[0] + 0.0003, original.location[1] + 0.0002],
        });
      }
      const at = new Date(problem.created_at).getTime() + 3 * 60 * MINUTE;
      reject(problem, original ? 'duplicate' : 'spam', original, Math.min(at, Date.now()));
      return;
    }
    const steps = historyOf(problem);
    const created = new Date(problem.created_at).getTime();
    if (problem.confirmations_count >= AUTO_CONFIRM_THRESHOLD) {
      const firstStep = steps[1] ? new Date(steps[1].changed_at).getTime() : Date.now();
      const at = created + (firstStep - created) * 0.8 || created + 30 * MINUTE;
      notify(user.id, { kind: 'confirmations', problem, count: problem.confirmations_count, at });
    }
    steps.slice(1).forEach((step) =>
      notify(user.id, {
        kind: 'status',
        problem,
        status: step.status,
        at: new Date(step.changed_at).getTime(),
      }),
    );
  });
  (inbox.get(user.id) ?? []).slice(2).forEach((item) => (item.read = true));
}

// Уведомление с кратким видом проблемы, чтобы список можно было показать без лишних запросов.
export function notificationsOf(user) {
  const items = (inbox.get(user.id) ?? []).map((item) => {
    const problem = problems.find((p) => p.id === item.problem_id);
    return {
      ...item,
      problem: problem && {
        id: problem.id,
        category: problem.category,
        district: problem.district,
        district_name: districtName(problem.district),
        status: problem.status,
        rejection_reason: problem.rejection_reason,
      },
    };
  });
  return { unread: items.filter((item) => !item.read).length, items };
}

export function markRead(user, ids) {
  (inbox.get(user.id) ?? []).forEach((item) => {
    if (!ids || ids.includes(item.id)) item.read = true;
  });
}

export function forgetUser(user) {
  inbox.delete(user.id);
  [...authors].forEach(
    ([problemId, authorId]) => authorId === user.id && authors.delete(problemId),
  );
}

export function problemsOf(user) {
  return problems
    .filter((problem) => authors.get(problem.id) === user.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(withHistory);
}

// Автор в сообщениях о проблемах — всегда актуальный публичный профиль (UserPublic).
export function syncAuthor(user) {
  problems
    .filter((problem) => authors.get(problem.id) === user.id)
    .forEach((problem) => {
      problem.author = { nickname: user.nickname, avatar_url: user.avatar_url };
    });
}
