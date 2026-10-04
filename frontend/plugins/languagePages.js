import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

// Страницы на каждом языке как отдельные HTML-файлы сборки: /en/about/index.html и т. д. Статический
// хостинг (GitHub Pages) отдаёт их с кодом 200, а поисковик сразу видит язык страницы, описание и
// ссылки на переводы (hreflang) — ещё до запуска приложения. Остальные адреса открывает 404.html —
// копия приложения без ссылок на переводы. С адресом сайта (SITE_URL) — ещё и sitemap.xml.
const DEFAULT_LANGUAGE = 'ru';
const CITY = 'kostanay';
const STATIC_PAGES = [
  '',
  'about',
  'support',
  'login',
  'register',
  `map/${CITY}`,
  `map/${CITY}/stats`,
];

const readJson = (path) => JSON.parse(readFileSync(path, 'utf-8'));
const escape = (text) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export function languagePages({ root, siteUrl }) {
  let outDir;
  return {
    name: 'viberay-language-pages',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const texts = join(root, 'src/texts');
      const languages = readdirSync(texts, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((a, b) => (a === DEFAULT_LANGUAGE ? -1 : b === DEFAULT_LANGUAGE ? 1 : 0));
      const districts = readJson(join(root, `src/demo-data/cities/${CITY}/districts.geojson`));
      const pages = [
        ...STATIC_PAGES,
        ...districts.features.map(({ properties }) => `map/${CITY}/district/${properties.slug}`),
      ];
      const base = siteUrl?.replace(/\/$/, '');
      const pathOf = (code, page) =>
        [code === DEFAULT_LANGUAGE ? '' : code, page].filter(Boolean).join('/');
      const urlOf = (code, page) => {
        const path = pathOf(code, page);
        return `${base}/${path}${path ? '/' : ''}`;
      };

      const template = readFileSync(join(outDir, 'index.html'), 'utf-8');
      writeFileSync(join(outDir, '404.html'), template);

      const render = (code, page) => {
        const { description } = readJson(join(texts, code, 'common.json')).meta;
        const links = base
          ? [
              ...languages.map(
                (other) =>
                  `<link rel="alternate" hreflang="${other}" href="${urlOf(other, page)}" data-language-link />`,
              ),
              `<link rel="alternate" hreflang="x-default" href="${urlOf(DEFAULT_LANGUAGE, page)}" data-language-link />`,
              `<link rel="canonical" href="${urlOf(code, page)}" data-language-link />`,
            ]
          : [];
        return template
          .replace(/<html lang="[^"]*"/, `<html lang="${code}"`)
          .replace(
            /<meta name="description" content="[^"]*"/,
            `<meta name="description" content="${escape(description)}"`,
          )
          .replace('</head>', `${links.map((link) => `    ${link}\n`).join('')}  </head>`);
      };

      languages.forEach((code) =>
        pages.forEach((page) => {
          const file = join(outDir, pathOf(code, page), 'index.html');
          if (!existsSync(dirname(file))) mkdirSync(dirname(file), { recursive: true });
          writeFileSync(file, render(code, page));
        }),
      );

      if (!base) return;
      const entries = pages.flatMap((page) =>
        languages.map((code) => {
          const alternates = languages
            .map(
              (other) =>
                `    <xhtml:link rel="alternate" hreflang="${other}" href="${urlOf(other, page)}"/>`,
            )
            .join('\n');
          return `  <url>\n    <loc>${urlOf(code, page)}</loc>\n${alternates}\n  </url>`;
        }),
      );
      writeFileSync(
        join(outDir, 'sitemap.xml'),
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ' +
          'xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
          `${entries.join('\n')}\n</urlset>\n`,
      );
    },
  };
}
