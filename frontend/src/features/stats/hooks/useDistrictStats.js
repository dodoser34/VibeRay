import { getDistrictStats } from '@/shared/api/endpoints/districts';
import { useRequest } from '@/shared/hooks/useRequest';

export function useDistrictStats(districtId, period) {
  return useRequest(districtId ? `stats:${districtId}:${period}` : null, () =>
    getDistrictStats(districtId, period),
  );
}
