# Иллюстрации VibeRay: один промт на все картинки

Один персонаж на весь сайт: одна и та же девушка-проводник в разных позах. Ниже — **один общий промт**:
его целиком копируют в ChatGPT (генерация изображений) или в Codex, и он по очереди делает все
картинки. Готовые файлы складываются в `docs/art/incoming/`, после чего Claude их просматривает,
отбраковывает неудачные и вставляет в проект.

## Как пользоваться

1. Новый чат в ChatGPT. Прикрепите эталон внешности —
   `frontend/src/features/settings/assets/profile-assistant.webp`.
2. Скопируйте блок «Общий промт» ниже целиком и отправьте.
3. ChatGPT делает по одной картинке и ждёт слова **next**. Если лицо, волосы или свитер «уплыли» —
   напишите **redo** (перегенерировать ту же картинку).
4. Скачанные PNG сохраните в `docs/art/incoming/` под именами из промта.
5. Если хотите выше разрешение — увеличьте каждую вдвое бесплатной программой Upscayl
   (режим «digital art»). ChatGPT сам отдаёт картинки примерно до 1536 px.
6. Напишите Claude: «картинки в incoming» — дальше он всё проверит и подключит.

## Что заменится и что добавится

| Файл | Куда на сайте | Что сейчас |
|------|---------------|------------|
| `00-character-sheet.png` | Никуда — эталон для остальных картинок | — |
| `01-hero-thinking.png` | Главная, герой | Другая девушка (рыжая) — заменить |
| `02-settings-hand-on-heart.png` | Настройки | Тот же персонаж, низкое разрешение |
| `03-support-welcome.png` | Поддержка, шапка | Две картинки под темы со свечением и наушниками — станет одна |
| `04-support-pointing.png` | Поддержка, частые вопросы | Тот же персонаж, низкое разрешение |
| `05-auth-waving.png` | Окно входа и регистрации | Нет картинки |
| `06-notfound-map.png` | Страница 404 | SVG-карта |
| `07-empty-reports-phone.png` | «Мои обращения» — пусто | Маленькая SVG-картинка |
| `08-empty-notifications-tea.png` | Уведомления — пусто | Иконка колокольчика |
| `09-tour-guide-avatar.png` | Подсказки тура по карте | Нет картинки |
| `10-report-sent-thumbs-up.png` | После отправки проблемы | Нет картинки |
| `11-moderation-done-tablet.png` | Модерация — очередь пуста | Нет картинки |
| `12-og-cover.png` | Превью ссылки в мессенджерах | Нет |

Персонажа **не ставим** на карту города, в статистику, карточки проблем и на «О проекте».
Логотип не генерируем: он векторный (`public/favicon.svg`), иконки для телефона делаются из него.

---

## Общий промт

````text
You are generating a consistent illustration set for "VibeRay" — a calm, friendly city-map website
where residents mark their mood and report city problems. All images show ONE recurring character.
The attached image is the reference for her appearance. Character consistency is the #1 priority.

=== RULES FOR THE WHOLE SESSION ===
1. Generate the images strictly ONE AT A TIME, in the order listed below.
2. After each image, write only: its file name, a one-line self-check (face / eyes / hair / sweater /
   background / no glow / no text — each "ok" or what is wrong), and the word "Waiting".
3. Then STOP and wait. If I write "next" — go to the next image. If I write "redo" — regenerate
   the same image, fixing what was wrong. Never skip ahead, never merge two images into one.
4. Starting from image 01, ALWAYS use image 00 (character sheet) and the attached reference
   as identity reference. Same face, same proportions, same hair, same sweater, same rendering.
5. Use the largest available output size with the requested orientation.
6. If you are able to save files (e.g. you are Codex with a file system), save each image as PNG
   with transparency to docs/art/incoming/<file name>. Otherwise just give me the image to download.

=== CHARACTER (identical in every image) ===
A young woman, about 23, stylized 3D animated-film look (soft Pixar/Disney-like rendering,
NOT photoreal, NOT anime).
- Face: soft oval face, slightly pointed chin, small straight nose, full rosy-pink lips, warm light
  skin with gentle peach blush on the cheeks and a few faint freckles on the nose.
- Eyes: large almond-shaped eyes, bright olive-green irises, long dark lashes.
- Brows: medium-thick, dark brown, softly arched.
- Hair: very long (below the chest), voluminous loose wavy curls, chestnut brown with warm caramel
  highlights, center part, no bangs, nothing in the hair.
- Clothing: oversized deep forest-green chunky knit crewneck sweater (about #2F5E3E), sleeves
  slightly covering the wrists. No jewelry, no logos, no text on clothing.
- Body: slim, average height, natural proportions.

=== STYLE (identical in every image unless an image says otherwise) ===
- Soft neutral studio light from the upper left, gentle shadows.
- FORBIDDEN: neon, glow, rim glow, bloom, light particles, sparkles, lens flare, bokeh dots.
- Muted natural colors. No pure white and no pure black anywhere.
- High detail on hair strands and knit texture, clean edges, sharp focus.
- Fully TRANSPARENT background (PNG with alpha): no floor, no ground shadow, no frame,
  no circle or shape behind her, no text, no letters, no icons, no watermark.
- Leave a small empty margin around her — nothing may be cut by the image edge except where
  a crop is explicitly requested (e.g. "cut at the waist").

=== IMAGES ===

00-character-sheet.png — landscape.
Character turnaround sheet on a plain light grey-green background (#E2EEDB) (the only image that
is not transparent). Front, three-quarter, side and back full-body views in the same outfit, plus a
row of 6 head close-ups: neutral, warm smile, laughing, thoughtful, surprised, mildly puzzled.
Even neutral lighting. No text labels.

01-hero-thinking.png — landscape, aspect ratio about 7:6 (e.g. 1356x1160 proportions).
Waist-up. She rests her chin on her loosely closed right fist, the fist touching her cheek, placed
slightly LEFT of the image center at about 45% of the image height. Elbow goes down out of frame.
Head tilted slightly, eyes looking up and to the RIGHT, dreamy happy half-smile, as if imagining
how her city could be better. Head center at about 48% width and 29% height of the image.
Hair spreads wide on both sides. The bottom edge cuts the sweater at the waist.

02-settings-hand-on-heart.png — portrait, aspect ratio about 0.84:1.
Waist-up, facing the viewer, right hand gently on her chest, friendly open smile with teeth
slightly visible, looking straight at the viewer — "this is about you". Cut at the waist.

03-support-welcome.png — square.
Waist-up, facing the viewer, both hands open in a welcoming "how can I help?" gesture: the left
hand lower in front of the body, the right hand raised to shoulder height with the palm up, on
the right side of the image. Calm kind smile, looking at the viewer. No headset, no circle,
no background shapes. Some empty space to the right of the head.

04-support-pointing.png — portrait, aspect ratio about 0.8:1.
Waist-up, body turned slightly to the left. She points with her right index finger up and to the
LEFT; the fingertip is near the left edge at about one third of the image height. She looks where
she points with a playful knowing smile — "the answer is right here". Cut at the waist.

05-auth-waving.png — portrait, aspect ratio about 0.83:1.
Waist-up, waving hello with the raised right hand, palm open toward the viewer, other arm relaxed.
Bright welcoming smile, slight head tilt, looking at the viewer. Cut at the waist.

06-notfound-map.png — square.
Waist-up. She holds a large unfolded paper city map with both hands in front of her: muted
beige-green paper with simple abstract streets, one corner of the map is blank. She looks at the
blank corner, mildly puzzled and amused, one eyebrow raised. No text or letters on the map.

07-empty-reports-phone.png — square.
Half-body, three-quarter view. She holds a smartphone horizontally with both hands, taking a
photo of something off-frame to the right, focused, slight smile. Phone screen faces away.

08-empty-notifications-tea.png — square.
Chest-up. She holds a muted sage-green ceramic mug with both hands near her chin, eyes softly
closed, peaceful relaxed smile — "all is quiet". A thin wisp of steam, NOT glowing.

09-tour-guide-avatar.png — square.
Head and shoulders, face centered and filling most of the frame (it will be cropped into a small
circle). Friendly smile, looking at the viewer, slight head tilt.

10-report-sent-thumbs-up.png — square.
Waist-up, confident thumbs-up with the right hand near her shoulder, cheerful grin, eyes slightly
squinting from the smile, looking at the viewer.

11-moderation-done-tablet.png — square.
Waist-up. She holds a tablet against her chest with one arm (screen facing away), the other hand
on her hip, satisfied proud smile — "everything is done".

12-og-cover.png — wide landscape, aspect ratio 1.91:1. NOT transparent (the only exception
besides 00).
She is waist-up in the right third, smiling at the viewer, holding a small round map pin.
Left two thirds: a calm stylized top-down view of a small city — muted green district blocks
separated by thin light lines, a river curving through it. Dark muted forest background
(#0B110D to #141D17), muted greens (#2F7A4A). The left half stays visually calm (a title will be
added later). No text, no letters, no logos, no glow, no neon.

Start now with 00-character-sheet.png.
````
