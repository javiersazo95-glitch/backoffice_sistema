import { useQuery } from '@tanstack/react-query';
import * as dashboardApi from '@/api/dashboard';

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => dashboardApi.getSummary(),
    refetchInterval: 30000,
  });
}