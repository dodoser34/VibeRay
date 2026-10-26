// Немецкий перевод — одним файлом сборки: language.js загружает его, только когда язык нужен.
export default import.meta.glob('../../../texts/de/*.json', { eager: true, import: 'default' });
