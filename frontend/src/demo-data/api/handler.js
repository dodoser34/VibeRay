import { ApiError } from '@/shared/api/client';
import { MOOD_BY_CODE } from '@/shared/config/moods';
import { PERIOD_CODES } from '@/shared/config/periods';
import { CATEGORY_BY_CODE } from '@/shared/config/problemCategories';
import {
  EMAIL_PATTERN,
  NICKNAME_PATTERN,
  PHOTO_MAX_BYTES,
  PHOTO_TYPES,
  PROBLEM_DESCRIPTION_MAX,
  PROBLEM_DESCRIPTION_MIN,
  PROBLEM_MAX_PHOTOS,
  SUPPORT_FILE_MAX_BYTES,
  SUPPORT_FILE_TYPES,
  SUPPORT_MAX_FILES,
  SUPPORT_MESSAGE_MAX,
  SUPPORT_MESSAGE_MIN,
} from '@/shared/config/validation';
import { SUPPORT_REQUEST_STATUSES, SUPPORT_TOPIC_BY_CODE } from '@/shared/config/support';
import {
  MODERATOR_TRANSITIONS,
  REJECTION_REASON_BY_CODE,
  WITHDRAWABLE_STATUSES,
} from '@/shared/config/problemStatuses';
import { isModerator } from '@/shared/config/roles';
import { evaluatePassword } from '@/shared/lib/passwordStrength';
import { format } from '@/shared/lib/i18n/format';
import errors from '@/texts/en/errors.json';
import {
  HOME_CITY,
  addMoodMark,
  addProblem,
  cityInfos,
  cityMoods,
  cityStats,
  cityOfDistrict,
  districtAt,
  districtStats,
  isDistrict,
  loadCity,
  problems,
} from './demoHistory';
import {
  addConfirmations,
  claimProblem,
  forgetUser,
  hideFromMine,
  isAuthor,
  markRead,
  moderate,
  notificationsOf,
  problemsOf,
  removeConfirmation,
  removeNotifications,
  seedReports,
  simulateNeighbours,
  syncAuthor,
  withdrawProblem,
  withHistory,
} from './community';
import { isQueueStatus, moderationItem, moderationQueue, moderationSummary } from './moderation';
import demoAccounts from '../accounts.json';
import demoSupport from '../support.json';
import cityCountries from '../countries.json';
import { demoContent, localizeDemo, nameOf, setResponseLanguage } from './locale';
import { DAY, HOUR } from './time';

const accounts = new Map(
  demoAccounts.map(({ password, user }) => [user.email, { password, user }]),
);
demoAccounts.forEach(({ user, reports = [] }) => seedReports(user, reports));
const sessions = new Map(); // токен → email
// Обращения в поддержку, новые первыми; в демо уже есть несколько от жителей.
const supportRequests = demoSupport.map(({ hours_ago: hoursAgo, ...request }, i) => ({
  ...request,
  id: `S-${String(demoSupport.length - i).padStart(4, '0')}`,
  created_at: new Date(Date.now() - hoursAgo * HOUR).toISOString(),
}));
const confirmations = new Map(); // id проблемы → Set id пользователей
const MAP_RECENT_MS = 30 * DAY; // решённые проблемы остаются на карте 30 дней

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

// Сообщения берутся из src/texts/<язык>/errors.json по ключу (ключ — код ошибки, если не задан
// другой).
function fail(status, code, messageKey = code, values = {}) {
  throw new ApiError(status, code, format(errors.api[messageKey], values));
}

function issueSession(email) {
  const token = `mock-${crypto.randomUUID()}`;
  sessions.set(token, email);
  return { access_token: token, user: accounts.get(email).user };
}

function currentAccount(token) {
  const email = sessions.get(token);
  if (!email) fail(401, 'unauthorized');
  return accounts.get(email);
}

function currentUser(token) {
  return currentAccount(token).user;
}

function requireModerator(token) {
  const user = currentUser(token);
  if (!isModerator(user)) fail(403, 'forbidden');
  return user;
}

// Автор анонимной проблемы не уходит наружу: его видят только он сам и модератор.
function withoutHiddenAuthor(problem, user) {
  const sees = user && (isAuthor(problem, user) || isModerator(user));
  return problem.is_anonymous && !sees ? { ...problem, author: null } : problem;
}

function nicknameTaken(nickname, exceptId) {
  return [...accounts.values()].some(
    ({ user }) => user.id !== exceptId && user.nickname.toLowerCase() === nickname.toLowerCase(),
  );
}

// Без входа — просто проблема; для вошедшего ещё и его отношение к ней.
function viewOf(problem, token) {
  const email = sessions.get(token);
  const user = email && accounts.get(email)?.user;
  const view = withHistory(withoutHiddenAuthor(problem, user));
  if (!user) return view;
  return {
    ...view,
    is_mine: isAuthor(problem, user),
    confirmed_by_me: Boolean(confirmations.get(problem.id)?.has(user.id)),
  };
}

async function cityOrFail(slug) {
  return (await loadCity(slug)) ?? fail(404, 'city_not_found');
}

// Отклонённое модератором сообщение существует только для автора: остальным — 404.
function findProblem(id, token) {
  const problem = problems.find((problem) => problem.id === id);
  const email = sessions.get(token);
  const user = email && accounts.get(email)?.user;
  const hidden = problem?.status === 'rejected' && !(user && isAuthor(problem, user));
  if (!problem || hidden) fail(404, 'problem_not_found');
  return problem;
}

// Свой город и район пользователя: район должен лежать в этом городе (город без района — можно).
// Геометрия города грузится здесь же: без неё районы другого города ещё неизвестны.
async function checkHome(citySlug, districtSlug) {
  if (!citySlug) {
    if (districtSlug) fail(422, 'city_required');
    return { home_city: null, home_district: null };
  }
  await cityOrFail(citySlug);
  if (districtSlug && cityOfDistrict(districtSlug) !== citySlug) fail(404, 'district_not_found');
  return { home_city: citySlug, home_district: districtSlug || null };
}

function checkPeriod(period) {
  if (!PERIOD_CODES.includes(period)) fail(422, 'invalid_period');
  return period;
}

const routes = [
  [
    'POST',
    /^\/auth\/register$/,
    async ({ body }) => {
      const email = body.email?.trim().toLowerCase();
      if (!EMAIL_PATTERN.test(email ?? '')) fail(422, 'invalid_email');
      if (!NICKNAME_PATTERN.test(body.nickname ?? '')) fail(422, 'invalid_nickname');
      if (accounts.has(email)) fail(409, 'email_taken');
      const password = evaluatePassword(body.password ?? '', { email, nickname: body.nickname });
      if (!password.acceptable) fail(422, 'weak_password');
      if (nicknameTaken(body.nickname)) fail(409, 'nickname_taken');
      if (!body.home_city) fail(422, 'city_required');
      const home = await checkHome(body.home_city, body.home_district);
      accounts.set(email, {
        password: body.password,
        user: {
          id: `u-${crypto.randomUUID()}`,
          email,
          nickname: body.nickname,
          avatar_url: body.avatar_url ?? 'preset:0',
          ...home,
          role: 'user',
        },
      });
      return issueSession(email);
    },
  ],
  [
    'POST',
    /^\/auth\/login$/,
    ({ body }) => {
      const email = body.email?.trim().toLowerCase();
      const account = accounts.get(email);
      if (!account || account.password !== body.password) fail(401, 'invalid_credentials');
      return issueSession(email);
    },
  ],
  [
    'POST',
    /^\/auth\/logout$/,
    ({ token }) => {
      sessions.delete(token);
      return null;
    },
  ],
  [
    'PATCH',
    /^\/users\/me$/,
    async ({ body, token }) => {
      const user = currentUser(token);
      if (body.nickname !== undefined) {
        if (!NICKNAME_PATTERN.test(body.nickname)) fail(422, 'invalid_nickname');
        if (nicknameTaken(body.nickname, user.id)) fail(409, 'nickname_taken');
      }
      if (body.avatar_url !== undefined && !/^preset:\d+$/.test(body.avatar_url)) {
        fail(422, 'invalid_avatar');
      }
      // Новый город без района сбрасывает район: прежний лежит в другом городе.
      const changesHome = body.home_city !== undefined || body.home_district !== undefined;
      const home =
        changesHome &&
        (await checkHome(
          body.home_city !== undefined ? body.home_city : user.home_city,
          body.home_district !== undefined
            ? body.home_district
            : body.home_city !== undefined && body.home_city !== user.home_city
              ? null
              : user.home_district,
        ));
      if (body.nickname !== undefined) user.nickname = body.nickname;
      if (body.avatar_url !== undefined) user.avatar_url = body.avatar_url;
      if (home) Object.assign(user, home);
      syncAuthor(user);
      return user;
    },
  ],
  [
    'PUT',
    /^\/users\/me\/avatar$/,
    ({ body, token }) => {
      const user = currentUser(token);
      const photo = body.get('avatar');
      if (!photo || !PHOTO_TYPES.includes(photo.type) || photo.size > PHOTO_MAX_BYTES) {
        fail(422, 'invalid_photo');
      }
      user.avatar_url = URL.createObjectURL(photo);
      syncAuthor(user);
      return user;
    },
  ],
  [
    'POST',
    /^\/users\/me\/password$/,
    ({ body, token }) => {
      const account = currentAccount(token);
      if (account.password !== body.current_password) fail(403, 'wrong_password');
      const check = evaluatePassword(body.new_password ?? '', account.user);
      if (!check.acceptable) fail(422, 'weak_password');
      account.password = body.new_password;
      return null;
    },
  ],
  [
    'DELETE',
    /^\/users\/me$/,
    ({ body, token }) => {
      const account = currentAccount(token);
      if (account.password !== body.password) fail(403, 'wrong_password');
      accounts.delete(account.user.email);
      [...sessions].forEach(([key, email]) => email === account.user.email && sessions.delete(key));
      forgetUser(account.user);
      return null;
    },
  ],
  ['GET', /^\/users\/me\/problems$/, ({ token }) => problemsOf(currentUser(token))],
  [
    'DELETE',
    /^\/users\/me\/problems\/([\w-]+)$/,
    ({ params, token }) => {
      const user = currentUser(token);
      const problem = findProblem(params[0], token);
      if (!isAuthor(problem, user)) fail(403, 'not_author');
      hideFromMine(user, problem);
      return null;
    },
  ],
  ['GET', /^\/users\/me\/notifications$/, ({ token }) => notificationsOf(currentUser(token))],
  [
    'POST',
    /^\/users\/me\/notifications\/read$/,
    ({ body, token }) => {
      markRead(currentUser(token), body?.ids);
      return null;
    },
  ],
  [
    'DELETE',
    /^\/users\/me\/notifications$/,
    ({ body, token }) => {
      removeNotifications(currentUser(token), body?.ids);
      return null;
    },
  ],
  [
    'GET',
    /^\/cities$/,
    () =>
      cityInfos().map((info) => ({
        slug: info.slug,
        name: nameOf(info),
        country: cityCountries[info.slug] ?? null,
        center: info.center,
        bbox: info.bbox,
      })),
  ],
  [
    'GET',
    /^\/cities\/([\w-]+)$/,
    async ({ params }) => {
      const city = await cityOrFail(params[0]);
      return {
        ...city,
        name: nameOf(city),
        country: cityCountries[city.slug] ?? null,
        districts: {
          ...city.districts,
          features: city.districts.features.map((feature) => ({
            ...feature,
            properties: { ...feature.properties, name: nameOf(feature.properties) },
          })),
        },
      };
    },
  ],
  [
    'GET',
    /^\/cities\/([\w-]+)\/moods$/,
    async ({ params, query }) =>
      cityMoods((await cityOrFail(params[0])).slug, checkPeriod(query.period)),
  ],
  [
    'GET',
    /^\/cities\/([\w-]+)\/stats$/,
    async ({ params, query }) =>
      cityStats((await cityOrFail(params[0])).slug, checkPeriod(query.period)),
  ],
  [
    'GET',
    /^\/districts\/([\w-]+)\/stats$/,
    ({ params, query }) => {
      if (!isDistrict(params[0])) fail(404, 'district_not_found');
      return districtStats(params[0], checkPeriod(query.period));
    },
  ],
  [
    'POST',
    /^\/districts\/([\w-]+)\/mood$/,
    ({ params, body, token }) => {
      const user = currentUser(token);
      if (!isDistrict(params[0])) fail(404, 'district_not_found');
      if (!MOOD_BY_CODE[body.mood]) fail(422, 'invalid_mood');
      addMoodMark(user.id, params[0], body.mood);
      return null;
    },
  ],
  [
    'POST',
    /^\/problems\/([\w-]+)\/confirm$/,
    ({ params, token }) => {
      const user = currentUser(token);
      const problem = findProblem(params[0], token);
      if (isAuthor(problem, user)) fail(409, 'own_problem');
      if (problem.status === 'rejected') fail(409, 'problem_rejected');
      const confirmedBy = confirmations.get(problem.id) ?? new Set();
      if (confirmedBy.has(user.id)) fail(409, 'already_confirmed');
      confirmedBy.add(user.id);
      confirmations.set(problem.id, confirmedBy);
      addConfirmations(problem, 1);
      return viewOf(problem, token);
    },
  ],
  [
    'DELETE',
    /^\/problems\/([\w-]+)\/confirm$/,
    ({ params, token }) => {
      const user = currentUser(token);
      const problem = findProblem(params[0], token);
      const confirmedBy = confirmations.get(problem.id);
      if (!confirmedBy?.has(user.id)) fail(409, 'not_confirmed');
      if (problem.status !== 'new') fail(409, 'confirmation_locked');
      confirmedBy.delete(user.id);
      removeConfirmation(problem);
      return viewOf(problem, token);
    },
  ],
  [
    'DELETE',
    /^\/problems\/([\w-]+)$/,
    ({ params, token }) => {
      const user = currentUser(token);
      const problem = findProblem(params[0], token);
      if (!isAuthor(problem, user)) fail(403, 'not_author');
      if (!WITHDRAWABLE_STATUSES.includes(problem.status)) fail(409, 'problem_in_work');
      withdrawProblem(problem);
      confirmations.delete(problem.id);
      return null;
    },
  ],
  [
    'POST',
    /^\/problems$/,
    ({ body, token }) => {
      const user = currentUser(token);
      const category = body.get('category');
      if (!CATEGORY_BY_CODE[category]) fail(422, 'invalid_category');
      const location = [Number(body.get('lon')), Number(body.get('lat'))];
      const district = districtAt(location);
      if (!district) fail(422, 'outside_city');
      const description = String(body.get('description') ?? '').trim();
      if (
        description.length < PROBLEM_DESCRIPTION_MIN ||
        description.length > PROBLEM_DESCRIPTION_MAX
      ) {
        fail(422, 'invalid_description');
      }
      const photos = body.getAll('photos');
      if (photos.length > PROBLEM_MAX_PHOTOS) fail(422, 'too_many_photos');
      if (
        photos.some((photo) => !PHOTO_TYPES.includes(photo.type) || photo.size > PHOTO_MAX_BYTES)
      ) {
        fail(422, 'invalid_photo');
      }
      const problem = addProblem({
        author: user,
        district,
        category,
        description,
        location,
        photos: photos.map((photo) => ({ url: URL.createObjectURL(photo) })),
        isAnonymous: body.get('is_anonymous') === 'true',
      });
      claimProblem(problem, user);
      simulateNeighbours(problem);
      return viewOf(problem, token);
    },
  ],
  [
    'POST',
    /^\/support\/requests$/,
    ({ body }) => {
      const topic = body.get('topic');
      if (!SUPPORT_TOPIC_BY_CODE[topic]) fail(422, 'invalid_topic');
      const email = String(body.get('email') ?? '').trim();
      if (!EMAIL_PATTERN.test(email)) fail(422, 'invalid_email', 'invalid_reply_email');
      const message = String(body.get('message') ?? '').trim();
      if (message.length < SUPPORT_MESSAGE_MIN || message.length > SUPPORT_MESSAGE_MAX) {
        fail(422, 'invalid_message');
      }
      const files = body.getAll('files');
      if (files.length > SUPPORT_MAX_FILES) fail(422, 'too_many_files');
      if (
        files.some(
          (file) => !SUPPORT_FILE_TYPES.includes(file.type) || file.size > SUPPORT_FILE_MAX_BYTES,
        )
      ) {
        fail(422, 'invalid_file');
      }
      const ticket = {
        id: `S-${String(supportRequests.length + 1).padStart(4, '0')}`,
        topic,
        created_at: new Date().toISOString(),
      };
      supportRequests.unshift({
        ...ticket,
        email,
        message,
        files_count: files.length,
        status: 'new',
      });
      return ticket;
    },
  ],
  [
    'GET',
    /^\/status$/,
    () => ({
      checked_at: new Date().toISOString(),
      services: ['site', 'map', 'auth', 'support'].map((code) => ({
        code,
        label: demoContent().services[code],
        state: 'operational',
      })),
    }),
  ],
  [
    'GET',
    /^\/problems\/([\w-]+)$/,
    ({ params, token }) => viewOf(findProblem(params[0], token), token),
  ],
  [
    'GET',
    /^\/problems$/,
    async ({ query }) => {
      if (query.city) await cityOrFail(query.city);
      return problems
        .filter(
          (problem) =>
            problem.status !== 'rejected' &&
            (!query.city || cityOfDistrict(problem.district) === query.city) &&
            (!query.district || problem.district === query.district) &&
            (!query.category || problem.category === query.category) &&
            (query.status
              ? problem.status === query.status
              : problem.status !== 'resolved' ||
                Date.now() - new Date(problem.created_at).getTime() < MAP_RECENT_MS),
        )
        .map((problem) => withoutHiddenAuthor(problem, null));
    },
  ],
  [
    'GET',
    /^\/moderation\/problems$/,
    async ({ query, token }) => {
      requireModerator(token);
      if (!isQueueStatus(query.status ?? 'active')) fail(422, 'invalid_status_change');
      const city = await cityOrFail(query.city ?? HOME_CITY);
      return moderationQueue({ ...query, city: city.slug });
    },
  ],
  [
    'GET',
    /^\/moderation\/summary$/,
    async ({ query, token }) => {
      requireModerator(token);
      const city = await cityOrFail(query.city ?? HOME_CITY);
      return moderationSummary(supportRequests, city.slug);
    },
  ],
  [
    'PATCH',
    /^\/problems\/([\w-]+)\/status$/,
    ({ params, body, token }) => {
      requireModerator(token);
      const problem = problems.find((problem) => problem.id === params[0]);
      if (!problem) fail(404, 'problem_not_found');
      if (!MODERATOR_TRANSITIONS[problem.status]?.includes(body.status)) {
        fail(409, 'invalid_status_change');
      }
      let duplicateOf = null;
      if (body.status === 'rejected') {
        if (!REJECTION_REASON_BY_CODE[body.reason]) fail(422, 'invalid_reason');
        if (body.duplicate_of) {
          duplicateOf = problems.find(
            (candidate) => candidate.id === body.duplicate_of && candidate !== problem,
          );
          if (!duplicateOf) fail(404, 'problem_not_found');
        }
      }
      moderate(problem, { status: body.status, reason: body.reason, duplicateOf });
      return moderationItem(problem);
    },
  ],
  [
    'GET',
    /^\/moderation\/support-requests$/,
    ({ token }) => {
      requireModerator(token);
      return supportRequests;
    },
  ],
  [
    'PATCH',
    /^\/moderation\/support-requests\/([\w-]+)$/,
    ({ params, body, token }) => {
      requireModerator(token);
      const request = supportRequests.find((request) => request.id === params[0]);
      if (!request) fail(404, 'not_found', 'not_found', { method: 'PATCH', path: params[0] });
      if (!SUPPORT_REQUEST_STATUSES.some((status) => status.code === body.status)) {
        fail(422, 'invalid_status_change');
      }
      request.status = body.status;
      return request;
    },
  ],
];

export async function handleMock(method, path, { body, query = {}, token, language }) {
  await wait(250 + Math.random() * 350);
  setResponseLanguage(language);
  for (const [routeMethod, pattern, handler] of routes) {
    const match = method === routeMethod && path.match(pattern);
    if (match) {
      const result = await handler({ params: match.slice(1), body, query, token });
      return localizeDemo(structuredClone(result));
    }
  }
  return fail(404, 'not_found', 'not_found', { method, path });
}
