import { PROBLEM_STATUSES } from '@/shared/config/problemStatuses';
import { createRandom, hashString } from '@/shared/lib/random';
import { city, problems } from './generate';

const ORDER = PROBLEM_STATUSES.map((status) => status.code);
const AUTO_CONFIRM_THRESHOLD = 3; // ARCHITECTURE.md 6.2
const MINUTE = 60_000;
// Демо «соседей»: через сколько после отправки новую проблему подтверждают и сколько человек.
const NEIGHBOURS = [
  { after: 25_000, count: 2 },
  { after: 70_000, count: 1 },
];

const authors = new Map(); // id проблемы → id автора
const histories = new Map(); // id проблемы → [{ status, changed_at }] (problem_status_changes)
const inbox = new Map(); // id пользователя → уведомления, новые первыми
const timers = new Set();
let lastNotification = 0;

const iso = (time) => new Date(time).toISOString();
const districtName = (slug) =>
  city.districts.features.find((f) => f.properties.slug === slug)?.properties.name ?? '';

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

function setStatus(problem, status) {
  problem.status = status;
  historyOf(problem).push({ status, changed_at: iso(Date.now()) });
  const author = authors.get(problem.id);
  if (author) notify(author, { kind: 'status', problem, status });
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

// Демо без сервера: соседи находят новую проблему и подтверждают её, пока автор на сайте.
export function simulateNeighbours(problem) {
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
    const problem = problems.find(
      (p) => p.id.startsWith('p') && p.status === status && !authors.has(p.id) && !taken.has(p.id),
    );
    if (!problem) return;
    taken.add(problem.id);
    claimProblem(problem, user);
    problem.author = { nickname: user.nickname, avatar_url: user.avatar_url };
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
