import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['dist', 'node_modules', 'e2e/output'] },
  js.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],
  reactHooks.configs.flat.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      'react/prop-types': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Имена — полными словами (CLAUDE.md §4). Одна буква — только индексы, координаты, доля t,
      // путь SVG d и пара a, b в сравнении для sort.
      'id-length': [
        'error',
        {
          min: 2,
          exceptions: ['i', 'j', 'k', 'x', 'y', 'z', 't', 'd', 'a', 'b', '_'],
          properties: 'never',
        },
      ],
    },
  },
  // Формулы с общепринятыми обозначениями: оси рисунка u, w на гранях изометрии, элементы аффинной
  // матрицы a…f, шум Перлина (X, Y, Z — ячейка, u, v, w — доли, A, B — хеши углов).
  {
    files: [
      'src/features/story/components/room/**',
      'src/features/story/lib/room/**',
      'src/shared/animations/background/SiteBackground.js',
    ],
    rules: {
      'id-length': [
        'error',
        {
          min: 2,
          exceptions: ['i', 'j', 'k', 'x', 'y', 'z', 't', 'd', 'a', 'b', '_', 'u', 'v', 'w'],
          exceptionPatterns: ['^[a-fA-FXYZ]$'],
          properties: 'never',
        },
      ],
    },
  },
];
