import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as mediationsApi from '@/api/mediations';
import type { MediationDetailResponse, MediationMessageResponse } from '@/types/mediation';
import type {
  MediationFilterRequest,
  InitMediationRequest,
  MediationMessageRequest,
  ResolveCaseRequest,
} from '@/types/mediation';

export function useMediations(filter?: MediationFilterRequest) {
  return useQuery({
    queryKey: ['mediations', filter],
    queryFn: () => mediationsApi.getMediations(filter),
  });
}

export function useMediation(id: number) {
  return useQuery({
    queryKey: ['mediation', id],
    queryFn: () => mediationsApi.getMediationById(id),
    enabled: !!id,
  });
}

export function useMediationMessages(mediationId: number, page = 0, size = 4) {
  return useQuery({
    queryKey: ['mediation-messages', mediationId, page, size],
    queryFn: () => mediationsApi.getMessages(mediationId, page, size),
    enabled: !!mediationId,
  });
}

export function useCreateMediation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: InitMediationRequest) => mediationsApi.createMediation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mediations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });
}

export function useInitMediation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: InitMediationRequest }) =>
      mediationsApi.initMediation(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['mediations'] });
      queryClient.invalidateQueries({ queryKey: ['mediation', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });
}

export function useBlockAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => mediationsApi.blockAccount(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['mediations'] });
      queryClient.invalidateQueries({ queryKey: ['mediation', id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });
}

export function useResolveCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data, document }: { id: number; data: ResolveCaseRequest; document: File }) =>
      mediationsApi.resolveCase(id, data, document),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mediations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });
}

export function useReactivateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data, document }: { id: number; data: ResolveCaseRequest; document: File }) =>
      mediationsApi.reactivateAccount(id, data, document),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['mediations'] });
      queryClient.invalidateQueries({ queryKey: ['mediation', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['sellers'] });
      queryClient.invalidateQueries({ queryKey: ['seller', data.sellerId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });
}

export function useAddMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mediationId, data }: { mediationId: number; data: MediationMessageRequest }) =>
      mediationsApi.addMessage(mediationId, data),
    onSuccess: (data, variables) => {
      queryClient.setQueryData<MediationDetailResponse | undefined>(['mediation', variables.mediationId], (current) => {
        if (!current) return current;
        const nextMessage: MediationMessageResponse = {
          ...data,
          text: data.text ?? variables.data.message,
          noteType: data.noteType ?? (variables.data.type as MediationMessageResponse['noteType']),
        };

        const updatedMessages = [...(current.messages ?? []), nextMessage];

        const targetRole = nextMessage.targetRole ?? variables.data.targetRole ?? 'AMBOS';
        const isInternal = nextMessage.internal ?? variables.data.isInternal ?? false;

        let updatedBuyerMessages = current.buyerMessages;
        let updatedSellerMessages = current.sellerMessages;

        if (!isInternal) {
          if (targetRole === 'COMPRADOR' || targetRole === 'AMBOS') {
            updatedBuyerMessages = [...(current.buyerMessages ?? []), nextMessage];
          }
          if (targetRole === 'VENDEDOR' || targetRole === 'AMBOS') {
            updatedSellerMessages = [...(current.sellerMessages ?? []), nextMessage];
          }
        }

        return {
          ...current,
          messages: updatedMessages,
          buyerMessages: updatedBuyerMessages,
          sellerMessages: updatedSellerMessages,
        };
      });
      queryClient.invalidateQueries({ queryKey: ['mediation-messages', variables.mediationId] });
      queryClient.invalidateQueries({ queryKey: ['mediation', variables.mediationId] });
    },
  });
}

export function useEditMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mediationId, messageId, data }: { mediationId: number; messageId: number; data: MediationMessageRequest }) =>
      mediationsApi.editMessage(mediationId, messageId, data),
    onSuccess: (data, variables) => {
      queryClient.setQueryData<MediationDetailResponse | undefined>(['mediation', variables.mediationId], (current) => {
        if (!current) return current;

        return {
          ...current,
          messages: (current.messages ?? []).map((message) =>
            message.id === variables.messageId
              ? {
                  ...message,
                  ...data,
                  text: data.text ?? variables.data.message,
                  noteType: data.noteType ?? (variables.data.type as MediationMessageResponse['noteType']),
                }
              : message,
          ),
        };
      });
      queryClient.invalidateQueries({ queryKey: ['mediation-messages', variables.mediationId] });
      queryClient.invalidateQueries({ queryKey: ['mediation', variables.mediationId] });
    },
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mediationId, messageId }: { mediationId: number; messageId: number }) =>
      mediationsApi.deleteMessage(mediationId, messageId),
    onSuccess: (_data, variables) => {
      queryClient.setQueryData<MediationDetailResponse | undefined>(['mediation', variables.mediationId], (current) => {
        if (!current) return current;

        return {
          ...current,
          messages: (current.messages ?? []).filter((message) => message.id !== variables.messageId),
        };
      });
      queryClient.invalidateQueries({ queryKey: ['mediation-messages', variables.mediationId] });
      queryClient.invalidateQueries({ queryKey: ['mediation', variables.mediationId] });
    },
  });
}
