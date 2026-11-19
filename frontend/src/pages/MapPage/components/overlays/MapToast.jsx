import styles from './MapToast.module.css';

// Короткое сообщение над нижней панелью (настроение сохранено, проблема отправлена или отозвана);
// когда его показывать и убирать — useToast.
export function MapToast({ toast }) {
  return (
    <p className={styles.toast} role="status" data-ui="map-toast">
      {toast.figure && (
        <img
          className={styles.figure}
          src={toast.figure}
          width="256"
          height="256"
          alt=""
          draggable="false"
        />
      )}
      {toast.text}
    </p>
  );
}
