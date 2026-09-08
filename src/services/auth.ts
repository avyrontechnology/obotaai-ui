import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  authEventListSchema,
  authMeSchema,
  inviteListSchema,
  userListSchema,
  userSchema,
  wsTicketSchema,
  type AcceptInviteInput,
  type AuthMe,
  type ChangePasswordInput,
  type InviteInput,
  type LoginInput,
  type Role,
  type SignupInput,
} from "@/lib/schemas/auth";

export const authKeys = {
  session: ["auth", "session"] as const,
  users: ["auth", "users"] as const,
  invites: ["auth", "invites"] as const,
  events: ["auth", "events"] as const,
};

export function useSession() {
  return useQuery({
    queryKey: authKeys.session,
    queryFn: async () => {
      const raw = await apiClient<unknown>("/auth/me");
      return authMeSchema.parse(raw) as AuthMe;
    },
    retry: false,
    staleTime: 60 * 1000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const raw = await apiClient<unknown>("/auth/login", {
        method: "POST",
        body: JSON.stringify(input),
      });
      return authMeSchema.parse(raw) as AuthMe;
    },
    onSuccess: (me) => {
      queryClient.setQueryData(authKeys.session, me);
      queryClient.invalidateQueries();
    },
  });
}

export function useSignup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SignupInput) => {
      // `confirm` is a client-side repeat check; the API takes password only.
      const { confirm, ...payload } = input;
      void confirm;
      const raw = await apiClient<unknown>("/auth/signup", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      return userSchema.parse(raw);
    },
    onSuccess: () => {
      // Session cookie is set server-side; refetch rather than fabricate.
      queryClient.invalidateQueries({ queryKey: authKeys.session });
      queryClient.invalidateQueries();
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiClient<unknown>("/auth/logout", { method: "POST" });
    },
    onSuccess: () => {
      queryClient.setQueryData(authKeys.session, null);
      queryClient.clear();
      window.location.replace("/login");
    },
  });
}

export function useUsers(enabled = true) {
  return useQuery({
    queryKey: authKeys.users,
    queryFn: async () => {
      const raw = await apiClient<unknown>("/auth/users");
      return userListSchema.parse(raw).users;
    },
    enabled,
  });
}

export function useInviteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: InviteInput) => {
      const raw = await apiClient<unknown>("/auth/invite", {
        method: "POST",
        body: JSON.stringify(input),
      });
      return raw as { invite_id: string; email: string; role: Role; token: string; expires_at: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.invites });
    },
  });
}

export function useInvites(enabled = true) {
  return useQuery({
    queryKey: authKeys.invites,
    queryFn: async () => {
      const raw = await apiClient<unknown>("/auth/invites");
      return inviteListSchema.parse(raw).invites;
    },
    enabled,
  });
}

export function useAcceptInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AcceptInviteInput) => {
      const { token, name, password } = input;
      const raw = await apiClient<unknown>("/auth/accept", {
        method: "POST",
        body: JSON.stringify({ token, name, password }),
      });
      return authMeSchema.parse(raw) as AuthMe;
    },
    onSuccess: (me) => {
      queryClient.setQueryData(authKeys.session, me);
      queryClient.invalidateQueries();
    },
  });
}

export function useSetUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: Role }) => {
      const raw = await apiClient<unknown>(`/auth/users/${id}/role`, {
        method: "PUT",
        body: JSON.stringify({ role }),
      });
      return userSchema.parse(raw);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.users });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient<unknown>(`/auth/users/${id}`, { method: "DELETE" });
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.users });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (input: ChangePasswordInput) => {
      const { current_password, new_password } = input;
      await apiClient<unknown>("/auth/password", {
        method: "PUT",
        body: JSON.stringify({ current_password, new_password }),
      });
    },
  });
}

export async function fetchWsTicket(): Promise<string> {
  const raw = await apiClient<unknown>("/auth/ws-ticket", { method: "POST" });
  return wsTicketSchema.parse(raw).ticket;
}

export function useAuthEvents(enabled = true) {
  return useQuery({
    queryKey: authKeys.events,
    queryFn: async () => {
      const raw = await apiClient<unknown>("/auth/events");
      return authEventListSchema.parse(raw).events;
    },
    enabled,
  });
}
