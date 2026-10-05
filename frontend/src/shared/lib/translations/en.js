// Английский перевод — одним файлом сборки: language.js загружает его, только когда язык нужен.
export default import.meta.glob('../../../texts/en/*.json', { eager: true, import: 'default' });
