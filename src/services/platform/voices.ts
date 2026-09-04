import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  createVoiceSchema,
  voiceEntrySchema,
  voiceListSchema,
  type CreateVoiceInput,
  type VoiceEntry,
} from "@/lib/schemas/platform";

export const voiceKeys = {
  all: ["voices"] as const,
  filtered: (agent_id?: string) => ["voices", { agent_id }] as const,
};

export function useVoices(agent_id?: string) {
  return useQuery({
    queryKey: voiceKeys.filtered(agent_id),
    queryFn: async () => {
      const query = agent_id ? `?agent_id=${encodeURIComponent(agent_id)}` : "";
      const raw = await apiClient<unknown>(`/voices${query}`);
      return voiceListSchema.parse(raw).voices;
    },
  });
}

export function useCreateVoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateVoiceInput) => {
      const raw = await apiClient<unknown>("/voices", {
        method: "POST",
        body: JSON.stringify(createVoiceSchema.parse(input)),
      });
      return voiceEntrySchema.parse(raw) as VoiceEntry;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: voiceKeys.all }),
  });
}

export function useDeleteVoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient<unknown>(`/voices/${id}`, { method: "DELETE" });
      return id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: voiceKeys.all }),
  });
}
