import { rmSync } from 'node:fs';

// Перед прогоном — чистый список нарушений и скриншотов: сводка описывает только этот прогон.
export default function setup() {
  for (const folder of ['issues', 'screens']) {
    rmSync(new URL(`../output/${folder}/`, import.meta.url), { recursive: true, force: true });
  }
}
