// Русский перевод — одним файлом сборки: language.js загружает его, только когда язык нужен.
export default import.meta.glob('../../../../texts/ru/*.json', { eager: true, import: 'default' });
