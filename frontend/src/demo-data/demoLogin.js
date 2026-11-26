import accounts from './accounts.json';

// Подсказка демо-входа (LoginForm, только в демо-режиме): обычный пользователь и модератор. label —
// ключ подписи в texts/<язык>/auth.json, раздел login (читается при рендере: язык меняется на
// лету).
export const DEMO_ACCOUNTS = [
  { id: 'u-user', label: 'demoResident' },
  { id: 'u-moderator', label: 'demoModerator' },
].map(({ id, label }) => {
  const account = accounts.find(({ user }) => user.id === id);
  return { id, label, email: account.user.email, password: account.password };
});
