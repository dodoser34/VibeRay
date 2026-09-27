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
import { SUPPORT_TOPIC_BY_CODE } from '@/shared/config/support';
import { evaluatePassword } from '@/shared/lib/passwordStrength';
import {
  addMoodMark,
  addProblem,
  city,
  cityMoods,
  cityStats,
  districtAt,
  districtStats,
  isDistrict,
  problems,
} from './generate';
import { format } from '@/shared/lib/format';
import demoAccounts from '../accounts.json';
import demo from '../content.json';
import errors from '@/texts/errors.json';

const accounts = new Map(demoAccounts.map((account) => [account.user.email, account]));
const sessions = new Map(); // токен → email
const supportRequests = [];
const confirmations = new Map(); // id проблемы → Set id пользователей
const authors = new Map(); // id проблемы → id автора: смена ника и аватара видна в его сообщениях
const AUTO_CONFIRM_THRESHOLD = 3; // ARCHITECTURE.md 6.2
const MAP_RECENT_MS = 30 * 24 * 3_600_000; // решённые проблемы остаются на карте 30 дней

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Сообщения берутся из src/texts/errors.json по ключу (ключ — код ошибки, если не задан другой).
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

function nicknameTaken(nickname, exceptId) {
  return [...accounts.values()].some(
    ({ user }) => user.id !== exceptId && user.nickname.toLowerCase() === nickname.toLowerCase(),
  );
}

// Автор в сообщениях о проблемах — всегда актуальный публичный профиль (UserPublic).
function syncAuthor(user) {
  problems
    .filter((problem) => authors.get(problem.id) === user.id)
    .forEach((problem) => {
      problem.author = { nickname: user.nickname, avatar_url: user.avatar_url };
    });
}

function checkPeriod(period) {
  if (!PERIOD_CODES.includes(period)) fail(422, 'invalid_period');
  return period;
}

const routes = [
  [
    'POST',
    /^\/auth\/register$/,
    ({ body }) => {
      const email = body.email?.trim().toLowerCase();
      if (!EMAIL_PATTERN.test(email ?? '')) fail(422, 'invalid_email');
      if (!NICKNAME_PATTERN.test(body.nickname ?? '')) fail(422, 'invalid_nickname');
      if (accounts.has(email)) fail(409, 'email_taken');
      const password = evaluatePassword(body.password ?? '', { email, nickname: body.nickname });
      if (!password.acceptable) fail(422, 'weak_password');
      if (nicknameTaken(body.nickname)) fail(409, 'nickname_taken');
      accounts.set(email, {
        password: body.password,
        user: {
          id: `u-${crypto.randomUUID()}`,
          email,
          nickname: body.nickname,
          avatar_url: body.avatar_url ?? 'preset:0',
          home_district: isDistrict(body.home_district) ? body.home_district : null,
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
    ({ body, token }) => {
      const user = currentUser(token);
      if (body.nickname !== undefined) {
        if (!NICKNAME_PATTERN.test(body.nickname)) fail(422, 'invalid_nickname');
        if (nicknameTaken(body.nickname, user.id)) fail(409, 'nickname_taken');
      }
      if (body.avatar_url !== undefined && !/^preset:\d+$/.test(body.avatar_url)) {
        fail(422, 'invalid_avatar');
      }
      if (body.home_district && !isDistrict(body.home_district)) {
        fail(404, 'district_not_found');
      }
      if (body.nickname !== undefined) user.nickname = body.nickname;
      if (body.avatar_url !== undefined) user.avatar_url = body.avatar_url;
      if (body.home_district !== undefined) user.home_district = body.home_district;
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
      return null;
    },
  ],
  [
    'GET',
    /^\/cities\/([\w-]+)$/,
    ({ params }) => {
      if (params[0] !== city.slug) fail(404, 'city_not_found');
      return city;
    },
  ],
  ['GET', /^\/cities\/([\w-]+)\/moods$/, ({ query }) => cityMoods(checkPeriod(query.period))],
  [
    'GET',
    /^\/cities\/([\w-]+)\/stats$/,
    ({ params, query }) => {
      if (params[0] !== city.slug) fail(404, 'city_not_found');
      return cityStats(checkPeriod(query.period));
    },
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
      const problem = problems.find((p) => p.id === params[0]);
      if (!problem) fail(404, 'problem_not_found');
      const confirmedBy = confirmations.get(problem.id) ?? new Set();
      if (confirmedBy.has(user.id)) fail(409, 'already_confirmed');
      confirmedBy.add(user.id);
      confirmations.set(problem.id, confirmedBy);
      problem.confirmations_count += 1;
      if (problem.status === 'new' && problem.confirmations_count >= AUTO_CONFIRM_THRESHOLD) {
        problem.status = 'confirmed';
      }
      return problem;
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
      });
      authors.set(problem.id, user.id);
      return problem;
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
        files.some((f) => !SUPPORT_FILE_TYPES.includes(f.type) || f.size > SUPPORT_FILE_MAX_BYTES)
      ) {
        fail(422, 'invalid_file');
      }
      const ticket = {
        id: `S-${String(supportRequests.length + 1).padStart(4, '0')}`,
        topic,
        created_at: new Date().toISOString(),
      };
      supportRequests.push({ ...ticket, email, message, files_count: files.length });
      return ticket;
    },
  ],
  [
    'GET',
    /^\/status$/,
    () => ({
      checked_at: new Date().toISOString(),
      services: [
        { code: 'site', label: demo.services.site, state: 'operational' },
        { code: 'map', label: demo.services.map, state: 'operational' },
        { code: 'auth', label: demo.services.auth, state: 'operational' },
        { code: 'support', label: demo.services.support, state: 'operational' },
      ],
    }),
  ],
  [
    'GET',
    /^\/problems$/,
    ({ query }) =>
      problems.filter(
        (p) =>
          (!query.district || p.district === query.district) &&
          (!query.category || p.category === query.category) &&
          (query.status
            ? p.status === query.status
            : p.status !== 'resolved' ||
              Date.now() - new Date(p.created_at).getTime() < MAP_RECENT_MS),
      ),
  ],
];

export async function handleMock(method, path, { body, query = {}, token }) {
  await wait(250 + Math.random() * 350);
  for (const [routeMethod, pattern, handler] of routes) {
    const match = method === routeMethod && path.match(pattern);
    if (match) return structuredClone(handler({ params: match.slice(1), body, query, token }));
  }
  return fail(404, 'not_found', 'not_found', { method, path });
}
