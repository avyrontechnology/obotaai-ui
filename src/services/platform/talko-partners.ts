import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  connectTalkoPartnerSchema,
  createTalkoPartnerSchema,
  talkoPartnerListSchema,
  talkoPartnerPreviewSchema,
  talkoPartnerViewSchema,
  updateTalkoPartnerSchema,
  type ConnectTalkoPartnerInput,
  type CreateTalkoPartnerInput,
  type TalkoPartner,
  type TalkoPartnerPreview,
  type UpdateTalkoPartnerInput,
} from "@/lib/schemas/platform";

export const talkoPartnerKeys = {
  all: ["talko-partners"] as const,
  detail: (id: string) => ["talko-partners", id] as const,
};

export function useTalkoPartners() {
  return useQuery({
    queryKey: talkoPartnerKeys.all,
    queryFn: async () => {
      const raw = await apiClient<unknown>("/talko/partners");
      return talkoPartnerListSchema.parse(raw).partners;
    },
  });
}

export function useTalkoPartner(id: string, enabled = true) {
  return useQuery({
    queryKey: talkoPartnerKeys.detail(id),
    queryFn: async () => {
      const raw = await apiClient<unknown>(`/talko/partners/${encodeURIComponent(id)}`);
      return talkoPartnerViewSchema.parse(raw) as TalkoPartner;
    },
    enabled: enabled && id.length > 0,
  });
}

function invalidatePartners(queryClient: ReturnType<typeof useQueryClient>, id?: string) {
  queryClient.invalidateQueries({ queryKey: talkoPartnerKeys.all });
  if (id) queryClient.invalidateQueries({ queryKey: talkoPartnerKeys.detail(id) });
}

export function useCreateTalkoPartner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTalkoPartnerInput) => {
      const raw = await apiClient<unknown>("/talko/partners", {
        method: "POST",
        body: JSON.stringify(createTalkoPartnerSchema.parse(input)),
      });
      return talkoPartnerViewSchema.parse(raw) as TalkoPartner;
    },
    onSuccess: (partner) => invalidatePartners(queryClient, partner.partner_id),
  });
}

export function useUpdateTalkoPartner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateTalkoPartnerInput & { id: string }) => {
      const raw = await apiClient<unknown>(`/talko/partners/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(updateTalkoPartnerSchema.parse(input)),
      });
      return talkoPartnerViewSchema.parse(raw) as TalkoPartner;
    },
    onSuccess: (partner) => invalidatePartners(queryClient, partner.partner_id),
  });
}

export function useDeleteTalkoPartner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient<unknown>(`/talko/partners/${encodeURIComponent(id)}`, { method: "DELETE" });
      return id;
    },
    onSuccess: (id) => invalidatePartners(queryClient, id),
  });
}

export function usePreviewTalkoPartner() {
  return useMutation({
    mutationFn: async (input: ConnectTalkoPartnerInput) => {
      const raw = await apiClient<unknown>("/talko/partners/preview", {
        method: "POST",
        body: JSON.stringify(connectTalkoPartnerSchema.parse(input)),
      });
      return talkoPartnerPreviewSchema.parse(raw) as TalkoPartnerPreview;
    },
  });
}

export function useConnectTalkoPartner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ConnectTalkoPartnerInput) => {
      const raw = await apiClient<unknown>("/talko/partners/connect", {
        method: "POST",
        body: JSON.stringify(connectTalkoPartnerSchema.parse(input)),
      });
      return talkoPartnerViewSchema.parse(raw) as TalkoPartner;
    },
    onSuccess: (partner) => invalidatePartners(queryClient, partner.partner_id),
  });
}

export function useRefreshTalkoPartnerDids() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // No dedicated POST .../refresh route exists on the backend (talko
      // partners router serves GET/PUT/DELETE on /{partner_id} only), so a
      // refresh is a re-fetch of the stored record.
      const raw = await apiClient<unknown>(`/talko/partners/${encodeURIComponent(id)}`);
      return talkoPartnerViewSchema.parse(raw) as TalkoPartner;
    },
    onSuccess: (partner) => invalidatePartners(queryClient, partner.partner_id),
  });
}
