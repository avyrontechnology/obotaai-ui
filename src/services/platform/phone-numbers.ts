import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  phoneNumberListSchema,
  phoneNumberSchema,
  type PhoneNumber,
} from "@/lib/schemas/platform";

export const phoneNumberKeys = {
  all: ["phone-numbers"] as const,
};

export function usePhoneNumbers() {
  return useQuery({
    queryKey: phoneNumberKeys.all,
    queryFn: async () => {
      const raw = await apiClient<unknown>("/phone-numbers");
      return phoneNumberListSchema.parse(raw).numbers;
    },
  });
}

export function useCreatePhoneNumber() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { number: string; provider?: PhoneNumber["provider"]; country?: string }) => {
      const raw = await apiClient<unknown>("/phone-numbers", {
        method: "POST",
        body: JSON.stringify(input),
      });
      return phoneNumberSchema.parse(raw) as PhoneNumber;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: phoneNumberKeys.all }),
  });
}

export function useAssignPhoneNumber() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, agent_id }: { id: string; agent_id: string }) => {
      const raw = await apiClient<unknown>(`/phone-numbers/${id}/assign`, {
        method: "POST",
        body: JSON.stringify({ agent_id }),
      });
      return phoneNumberSchema.parse(raw) as PhoneNumber;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: phoneNumberKeys.all }),
  });
}

export function useUnassignPhoneNumber() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const raw = await apiClient<unknown>(`/phone-numbers/${id}/unassign`, { method: "POST" });
      return phoneNumberSchema.parse(raw) as PhoneNumber;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: phoneNumberKeys.all }),
  });
}

export function useDeletePhoneNumber() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient<unknown>(`/phone-numbers/${id}`, { method: "DELETE" });
      return id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: phoneNumberKeys.all }),
  });
}
