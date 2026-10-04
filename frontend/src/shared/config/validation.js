// Повторяет правила бэкенда (ARCHITECTURE.md, разделы 4 и 8).
// Буквы: латиница с немецкими ä ö ü ß, кириллица с казахскими ә ғ қ ң ө ұ ү һ і.
export const NICKNAME_PATTERN = /^[a-zA-ZäöüßÄÖÜ0-9_а-яА-ЯёЁәғқңөұүһіӘҒҚҢӨҰҮҺІ]{3,24}$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_MIN_LENGTH = 8;

// Сообщения о проблемах (ARCHITECTURE.md 4 и 8)
export const PROBLEM_DESCRIPTION_MIN = 10;
export const PROBLEM_DESCRIPTION_MAX = 1000;
export const PROBLEM_MAX_PHOTOS = 3;
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Обращения в поддержку (ARCHITECTURE.md 4 и 7)
export const SUPPORT_MESSAGE_MIN = 10;
export const SUPPORT_MESSAGE_MAX = 2000;
export const SUPPORT_MAX_FILES = 3;
export const SUPPORT_FILE_MAX_BYTES = 10 * 1024 * 1024;
export const SUPPORT_FILE_TYPES = [...PHOTO_TYPES, 'application/pdf'];
