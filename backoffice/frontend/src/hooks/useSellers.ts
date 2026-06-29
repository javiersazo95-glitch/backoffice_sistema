import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as sellersApi from '@/api/sellers';
import type {
  SellerFilterRequest,
  CreateSellerRequest,
  UpdateSellerRequest,
  SuspendSellerRequest,
} from '@/types/seller';

export function useSellers(filter?: SellerFilterRequest) {
  return useQuery({
    queryKey: ['sellers', filter],
    queryFn: () => sellersApi.getSellers(filter),
  });
}

export function useSeller(id: number) {
  return useQuery({
    queryKey: ['seller', id],
    queryFn: () => sellersApi.getSellerById(id),
    enabled: !!id,
  });
}

export function useCreateSeller() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSellerRequest) => sellersApi.createSeller(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });
}

export function useUpdateSeller() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateSellerRequest }) =>
      sellersApi.updateSeller(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sellers'] });
      queryClient.invalidateQueries({ queryKey: ['seller', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['audits'] });
      queryClient.invalidateQueries({ queryKey: ['seller-block-history', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });
}

export function useSuspendSeller() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: SuspendSellerRequest }) =>
      sellersApi.suspendSeller(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sellers'] });
      queryClient.invalidateQueries({ queryKey: ['seller', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['audits'] });
      queryClient.invalidateQueries({ queryKey: ['seller-block-history', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });
}

export function useSellerTickets(id: number) {
  return useQuery({
    queryKey: ['seller-tickets', id],
    queryFn: () => sellersApi.getSellerTickets(id),
    enabled: !!id,
  });
}

export function useSellerDocuments(id: number) {
  return useQuery({
    queryKey: ['seller-documents', id],
    queryFn: () => sellersApi.getSellerDocuments(id),
    enabled: !!id,
  });
}
