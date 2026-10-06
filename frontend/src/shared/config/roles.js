// Коды должны совпадать с backend/app/models/enums.py (UserRole).
export const USER_ROLES = ['user', 'moderator', 'admin'];

// Модерацию (раздел /moderation, смена статусов проблем, обращения) видят модератор и администратор.
export const isModerator = (user) => user?.role === 'moderator' || user?.role === 'admin';
