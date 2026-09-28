import { PHOTO_MAX_BYTES, PHOTO_TYPES } from '@/shared/config/validation';
import common from '@/texts/ru/common.json';

const MAX_SIDE = 1600;
const QUALITY = 0.85;

export function checkPhoto(file) {
  if (!PHOTO_TYPES.includes(file.type)) return common.photo.wrongType;
  if (file.size > PHOTO_MAX_BYTES) return common.photo.tooBig;
  return null;
}

// Перекодирует фото через canvas: уменьшает до 1600 px и удаляет все метаданные (EXIF с GPS и
// моделью камеры не покидает устройство). Бэкенд удаляет EXIF ещё раз.
export async function preparePhoto(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error(common.photo.processFailed))),
      'image/jpeg',
      QUALITY,
    ),
  );
}
