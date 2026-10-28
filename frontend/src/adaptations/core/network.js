// Хорошая ли сеть для фоновой подгрузки страниц: не при экономии трафика и не на медленной сети.
const SLOW_NETWORKS = ['slow-2g', '2g', '3g'];

export function canPrefetch() {
  const connection = navigator.connection;
  return !connection?.saveData && !SLOW_NETWORKS.includes(connection?.effectiveType);
}
