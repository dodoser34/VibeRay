import * as THREE from 'three';
import { cssVar } from '@/shared/lib/cssVar';
import about from '@/texts/ru/about.json';
import { getLanguage } from '@/shared/lib/language';
import { story } from '../content';

const W = 1600;
const H = 900;
const EDITOR = { x: 330, y: 130, w: 940, h: 560 };
const screen = about.screen;
const IDEAS = [
  { key: 'shop', kind: 'site' },
  { key: 'habits', kind: 'chart' },
  { key: 'game', kind: 'app' },
  { key: 'studyNetwork', kind: 'site' },
  { key: 'finance', kind: 'chart' },
];

const DOCK = [
  '--color-accent',
  '--color-river',
  '--mood-normal',
  '--mood-bad',
  '--district-8',
  '--district-9',
  '--color-text-muted',
];

// Экран монитора как живой холст: спокойный рабочий стол с пустым «idea.txt» в редакторе; поверх
// всплывают карточки идей и зачёркиваются; затем с кареткой печатается вопрос.
export class ScreenTexture {
  constructor({ daylight = false } = {}) {
    this.daylight = daylight;
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
    this.c = {
      screen: cssVar('--story-screen'),
      panel: cssVar('--color-bg-raised'),
      deep: cssVar('--color-bg-deep'),
      line: cssVar('--color-glass-border'),
      contour: cssVar('--bg-contour'),
      text: cssVar('--color-text'),
      muted: cssVar('--color-text-muted'),
      faint: cssVar('--color-text-faint'),
      accent: cssVar('--color-accent-bright'),
      red: cssVar('--mood-angry'),
      yellow: cssVar('--mood-normal'),
      green: cssVar('--mood-excellent'),
    };
    this.display = cssVar('--font-display');
    this.body = cssVar('--font-body');
    this.language = getLanguage();
    this.desktop = this.paintDesktop();
    this.lastKey = '';
  }

  // ideas: 0..1 — мелькание карточек; typed: 0..1 — доля напечатанного вопроса; mapIn: 0..1 — карта
  // города занимает экран (монтажный переход в 3D-город); time — для каретки.
  update({ ideas, typed, mapIn }, time) {
    // Язык сменили на лету — рабочий стол с подписями папок рисуется заново.
    if (this.language !== getLanguage()) {
      this.language = getLanguage();
      this.desktop = this.paintDesktop();
      this.lastKey = '';
    }
    const chars = Math.round(typed * story.screenQuestion.length);
    const caretOn = Math.floor(time * 2) % 2 === 0;
    const key = `${ideas.toFixed(3)}|${chars}|${caretOn}|${mapIn.toFixed(3)}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    const { ctx } = this;
    ctx.drawImage(this.desktop, 0, 0);
    this.drawEditor(chars, caretOn);
    IDEAS.forEach((idea, k) => this.drawIdea(idea, k, ideas));
    this.drawPointer(1180, 610);
    if (this.map && mapIn > 0) {
      ctx.globalAlpha = mapIn;
      ctx.drawImage(this.map, 0, 0);
      ctx.globalAlpha = 1;
    }
    this.texture.needsUpdate = true;
  }

  // Плоская карта города в той же рамке, что 3D-город при взгляде строго сверху (тот же центр, та
  // же доля кадра), поэтому переход с экрана в 3D-сцену бесшовный.
  setMap(features, project, { viewHeightKm }) {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = cssVar('--scene-bg');
    ctx.fillRect(0, 0, W, H);
    const scale = H / viewHeightKm; // px на км
    const toPx = ([lon, lat]) => {
      const [x, y] = project([lon, lat]);
      return [W / 2 + x * scale, H / 2 - y * scale];
    };
    features.forEach(({ properties, geometry }) => {
      ctx.fillStyle = cssVar(`--district-${properties.palette}`);
      ctx.strokeStyle = cssVar('--scene-district-edge');
      ctx.lineWidth = 2;
      geometry.coordinates.forEach(([outer, ...holes]) => {
        ctx.beginPath();
        [outer, ...holes].forEach((ring) =>
          ring.forEach((point, i) => {
            const [px, py] = toPx(point);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }),
        );
        ctx.fill('evenodd');
        ctx.stroke();
      });
    });
    this.map = canvas;
    this.lastKey = '';
  }

  // Всё неподвижное — обои, строка меню, папки, док — рисуется один раз.
  paintDesktop() {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    const { c } = this;
    const wallpaper = ctx.createLinearGradient(0, 0, W, H);
    wallpaper.addColorStop(0, c.panel);
    wallpaper.addColorStop(1, c.screen);
    ctx.fillStyle = wallpaper;
    ctx.fillRect(0, 0, W, H);
    // изолинии на обоях (тот же мотив, что фон сайта)
    ctx.strokeStyle = c.contour;
    ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      for (let x = 0; x <= W; x += 20) {
        const y = 120 + i * 90 + Math.sin(x / 210 + i * 0.8) * 36 + Math.sin(x / 90 + i) * 10;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.fillStyle = c.deep;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(0, 0, W, 44);
    ctx.globalAlpha = 1;
    // пункты меню расставлены по реальной ширине с равным промежутком
    const BAR_MID = 22;
    const GAP = 30;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = c.text;
    ctx.font = `600 22px ${this.body}`;
    let x = 28;
    ctx.fillText(screen.appName, x, BAR_MID);
    x += ctx.measureText(screen.appName).width + GAP + 6;
    ctx.fillStyle = c.muted;
    ctx.font = `500 21px ${this.body}`;
    screen.menu.forEach((item) => {
      ctx.fillText(item, x, BAR_MID);
      x += ctx.measureText(item).width + GAP;
    });

    // зона статуса справа налево: дата, батарея, wi-fi — всё по центру строки
    const date = this.daylight ? screen.dateDaylight : screen.date;
    let right = W - 28;
    ctx.textAlign = 'right';
    ctx.fillText(date, right, BAR_MID);
    ctx.textAlign = 'left';
    right -= ctx.measureText(date).width + 22;
    ctx.strokeStyle = c.muted;
    ctx.fillStyle = c.muted;
    ctx.lineWidth = 2;
    const batW = 32;
    const batH = 16;
    ctx.beginPath();
    ctx.roundRect(right - batW - 4, BAR_MID - batH / 2, batW, batH, 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(right - batW - 1, BAR_MID - batH / 2 + 3, batW - 12, batH - 6, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(right - 3, BAR_MID - 3, 3, 6, 1);
    ctx.fill();
    right -= batW + 4 + 20;
    const wifiX = right - 12;
    const wifiY = BAR_MID + 8;
    ctx.lineCap = 'round';
    for (let r = 1; r <= 3; r++) {
      ctx.beginPath();
      ctx.arc(wifiX, wifiY, r * 5.5, -Math.PI * 0.78, -Math.PI * 0.22);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(wifiX, wifiY, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineCap = 'butt';

    screen.folders.forEach((name, i) => {
      const y = 90 + i * 120;
      ctx.fillStyle = c.accent;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.roundRect(52, y, 64, 18, 5);
      ctx.fill();
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.roundRect(46, y + 10, 76, 52, 8);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = c.text;
      ctx.font = `500 19px ${this.body}`;
      ctx.textAlign = 'center';
      ctx.fillText(name, 84, y + 84);
      ctx.textAlign = 'left';
    });

    const dockW = DOCK.length * 78 + 24;
    const dockX = W / 2 - dockW / 2;
    ctx.fillStyle = c.deep;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.roundRect(dockX, H - 104, dockW, 86, 24);
    ctx.fill();
    ctx.globalAlpha = 1;
    DOCK.forEach((token, i) => {
      const x = dockX + 22 + i * 78;
      ctx.fillStyle = cssVar(token);
      ctx.beginPath();
      ctx.roundRect(x, H - 94, 62, 62, 16);
      ctx.fill();
      ctx.fillStyle = c.deep;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.arc(x + 31, H - 63, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    ctx.fillStyle = c.text;
    ctx.beginPath();
    ctx.arc(dockX + 53, H - 24, 3, 0, Math.PI * 2); // запущенный редактор
    ctx.fill();
    return canvas;
  }

  drawEditor(chars, caretOn) {
    const { ctx, c } = this;
    const { x, y, w, h } = EDITOR;
    ctx.fillStyle = c.deep;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.roundRect(x + 8, y + 14, w, h, 18); // мягкая нейтральная тень
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = c.screen;
    ctx.strokeStyle = c.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 18);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = c.panel;
    ctx.beginPath();
    ctx.roundRect(x, y, w, 50, [18, 18, 0, 0]);
    ctx.fill();
    [c.red, c.yellow, c.green].forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + 30 + i * 28, y + 25, 8, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.textBaseline = 'middle';
    ctx.fillStyle = c.muted;
    ctx.font = `500 20px ${this.body}`;
    ctx.textAlign = 'center';
    ctx.fillText(screen.fileName, x + w / 2, y + 26);
    ctx.textAlign = 'left';

    // номера строк и печатаемый вопрос
    ctx.font = `500 22px ${this.body}`;
    ctx.fillStyle = c.faint;
    for (let n = 1; n <= 9; n++) ctx.fillText(String(n), x + 28, y + 37 + n * 50);
    ctx.fillStyle = c.line;
    ctx.fillRect(x + 66, y + 50, 2, h - 50);
    const text = story.screenQuestion.slice(0, chars);
    // Кегль подбирается по всей фразе (на английском она длиннее), чтобы строка с кареткой не
    // выходила за окно редактора и не менялась по ходу печати.
    ctx.font = `600 40px ${this.display}`;
    const room = w - 96 - 40;
    const size = Math.min(
      40,
      Math.floor((40 * room) / ctx.measureText(story.screenQuestion).width),
    );
    ctx.font = `600 ${size}px ${this.display}`;
    ctx.fillStyle = c.text;
    const tx = x + 96;
    const ty = y + 87;
    ctx.fillText(text, tx, ty);
    if (caretOn) {
      ctx.fillStyle = c.accent;
      ctx.fillRect(tx + ctx.measureText(text).width + 6, ty - 25, 4, 50);
    }
    ctx.textBaseline = 'alphabetic';
  }

  // Каждая идея живёт в своём отрезке прогресса: всплывает, зачёркивается, растворяется.
  drawIdea(idea, k, ideas) {
    // последняя карточка должна полностью исчезнуть к ideas = 1, до того как начнёт печататься
    // вопрос
    const local = ideas * ((IDEAS.length - 1) * 0.75 + 1.6) - k * 0.75;
    if (local <= 0 || local >= 1.6) return;
    const alpha = Math.min(1, local * 4) * Math.min(1, (1.6 - local) * 2);
    const { ctx, c } = this;
    const w = 300;
    const h = 200;
    // карточки разбросаны по телу редактора, всегда целиком внутри окна
    const left = EDITOR.x + 96;
    const top = EDITOR.y + 70;
    const cx = left + ((k * 0.61) % 1) * (EDITOR.w - w - 96 - 24);
    const cy = top + ((k * 0.37 + 0.15) % 1) * (EDITOR.h - h - 70 - 24 - 18);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy - local * 18);
    ctx.fillStyle = c.panel;
    ctx.strokeStyle = c.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 16);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = c.text;
    const title = screen.ideas[idea.key];
    ctx.font = `600 22px ${this.body}`;
    // Длинное название (на другом языке) уменьшается, чтобы не выходить за карточку.
    const size = Math.min(22, Math.floor((22 * (w - 40)) / ctx.measureText(title).width));
    ctx.font = `600 ${size}px ${this.body}`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(title, 20, 38);
    ctx.fillStyle = c.line;
    if (idea.kind === 'site') {
      ctx.fillRect(20, 60, w - 40, 36);
      for (let i = 0; i < 4; i++) ctx.fillRect(20, 110 + i * 18, (w - 40) * (0.9 - i * 0.15), 9);
    } else if (idea.kind === 'chart') {
      for (let i = 0; i < 8; i++) {
        const bh = 24 + ((i * 37 + k * 11) % 80);
        ctx.fillRect(22 + i * 33, h - 20 - bh, 22, bh);
      }
    } else {
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.roundRect(22 + (i % 4) * 68, 62 + Math.floor(i / 4) * 66, 52, 52, 12);
        ctx.fill();
      }
    }
    // отклонено: зачёркивание через весь заголовок на середине строчных букв
    if (local > 1) {
      const titleWidth = ctx.measureText(title).width;
      ctx.strokeStyle = c.red;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(18, 31);
      ctx.lineTo(18 + (titleWidth + 4) * Math.min(1, (local - 1) * 6), 31);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawPointer(x, y) {
    const { ctx, c } = this;
    ctx.fillStyle = c.text;
    ctx.strokeStyle = c.deep;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + 34);
    ctx.lineTo(x + 9, y + 26);
    ctx.lineTo(x + 16, y + 40);
    ctx.lineTo(x + 22, y + 37);
    ctx.lineTo(x + 15, y + 24);
    ctx.lineTo(x + 26, y + 24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  dispose() {
    this.texture.dispose();
  }
}
