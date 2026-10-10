import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  authorizeUrlResponseSchema,
  authorizeUrlSchema,
  connectCredentialResponseSchema,
  connectCredentialSchema,
  credentialMetaListSchema,
  credentialMetaSchema,
  dcrRegisterResponseSchema,
  dcrRegisterSchema,
  linkIntegrationSchema,
  mcpTemplateListSchema,
  partnerIntegrationListSchema,
  partnerIntegrationSchema,
  saveTemplateResponseSchema,
  saveTemplateSchema,
  syncToolsResponseSchema,
  type ConnectCredentialInput,
  type CredentialMeta,
  type AuthorizeUrlInput,
  type AuthorizeUrlResponse,
  type DcrRegisterInput,
  type DcrRegisterResponse,
  type LinkIntegrationInput,
  type McpTemplate,
  type PartnerIntegration,
  type SaveTemplateInput,
  type SyncToolsResponse,
} from "@/lib/schemas/platform";

/** MCP provider integrations (backend spec 0058): curated templates, vault
 *  credential metadata (ciphertext never leaves the store — reads project
 *  identifiers + expiry only), agent links, and outbound OAuth DCR.
 *
 *  Reads merge nothing client-side; writes touch one endpoint each.
 *  `POST /partner-credentials` is idempotent by provider (the response tells
 *  whether a row was replaced); linking without a live credential fails 400.
 */

export const mcpKeys = {
  all: ["mcp"] as const,
  templates: ["mcp", "templates"] as const,
  credentials: ["mcp", "credentials"] as const,
  integrations: {
    all: ["mcp", "integrations"] as const,
    byAgent: (agentId?: string) => ["mcp", "integrations", { agentId: agentId ?? null }] as const,
  },
};

export function useIntegrationTemplates(enabled = true) {
  return useQuery({
    queryKey: mcpKeys.templates,
    queryFn: async () => {
      const raw = await apiClient<unknown>("/integration-templates");
      return mcpTemplateListSchema.parse(raw).templates;
    },
    staleTime: 30 * 1000,
    retry: false,
    enabled,
  });
}

export function usePartnerCredentials(enabled = true) {
  return useQuery({
    queryKey: mcpKeys.credentials,
    queryFn: async () => {
      const raw = await apiClient<unknown>("/partner-credentials");
      return credentialMetaListSchema.parse(raw).credentials;
    },
    staleTime: 30 * 1000,
    retry: false,
    enabled,
  });
}

/** Sealed credential plus its one-time plaintext. The backend returns the
 *  row flat (metadata + `secret_once` + `replaced`); the hook reshapes to
 *  `{ meta, secret_once, replaced }` so callers can show the secret once and
 *  keep only metadata in long-lived state. */
export interface ConnectedCredential {
  meta: CredentialMeta;
  secret_once: string;
  replaced: boolean;
}

export function useConnectCredential() {
  const queryClient = useQueryClient();
  return useMutation({
    // gcTime 0: the resolved value carries `secret_once` in plaintext. The
    // default 5-minute gc would keep it parked in the mutation cache after the
    // dialog unmounts, where React Query Devtools (and anything else holding a
    // cache reference) can still read it. Drop it as soon as the consumer is
    // done — the dialog copies it once, then it is never needed again.
    gcTime: 0,
    mutationFn: async (input: ConnectCredentialInput): Promise<ConnectedCredential> => {
      const raw = await apiClient<unknown>("/partner-credentials", {
        method: "POST",
        body: JSON.stringify(connectCredentialSchema.parse(input)),
      });
      const parsed = connectCredentialResponseSchema.parse(raw);
      return {
        meta: credentialMetaSchema.parse(parsed) as CredentialMeta,
        secret_once: parsed.secret_once,
        replaced: parsed.replaced,
      };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mcpKeys.all }),
  });
}

export function useRevokeCredential() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient<unknown>(`/partner-credentials/${encodeURIComponent(id)}`, { method: "DELETE" });
      return id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mcpKeys.all }),
  });
}

export function usePartnerIntegrations(agentId?: string, enabled = true) {
  return useQuery({
    queryKey: mcpKeys.integrations.byAgent(agentId),
    queryFn: async () => {
      const query = agentId ? `?agent_id=${encodeURIComponent(agentId)}` : "";
      const raw = await apiClient<unknown>(`/partner-integrations${query}`);
      return partnerIntegrationListSchema.parse(raw).integrations;
    },
    staleTime: 30 * 1000,
    retry: false,
    enabled,
  });
}

export function useLinkIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: LinkIntegrationInput) => {
      const raw = await apiClient<unknown>("/partner-integrations", {
        method: "POST",
        body: JSON.stringify(linkIntegrationSchema.parse(input)),
      });
      return partnerIntegrationSchema.parse(raw) as PartnerIntegration;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mcpKeys.all }),
  });
}

export function useUnlinkIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient<unknown>(`/partner-integrations/${encodeURIComponent(id)}`, { method: "DELETE" });
      return id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mcpKeys.all }),
  });
}

export function useSaveTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveTemplateInput) => {
      const raw = await apiClient<unknown>("/integration-templates", {
        method: "POST",
        body: JSON.stringify(saveTemplateSchema.parse(input)),
      });
      return saveTemplateResponseSchema.parse(raw) as { replaced: boolean } & McpTemplate;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mcpKeys.all }),
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (provider: string) => {
      await apiClient<unknown>(`/integration-templates/${encodeURIComponent(provider)}`, { method: "DELETE" });
      return provider;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mcpKeys.all }),
  });
}

export function useSyncTools() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (provider: string): Promise<SyncToolsResponse> => {
      const raw = await apiClient<unknown>(
        `/integration-templates/${encodeURIComponent(provider)}/sync-tools`,
        { method: "POST" }
      );
      return syncToolsResponseSchema.parse(raw);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mcpKeys.all });
      queryClient.invalidateQueries({ queryKey: ["tools"] });
    },
  });
}

export function useDcrRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    // No secret ever reaches the client here: the issued secret seals
    // server-side at registration and the response carries identifiers
    // only (client_id, issuer_url). gcTime 0 stays as belt-and-braces.
    gcTime: 0,
    mutationFn: async (input: DcrRegisterInput) => {
      const raw = await apiClient<unknown>("/integrations/dcr-register", {
        method: "POST",
        body: JSON.stringify(dcrRegisterSchema.parse(input)),
      });
      return dcrRegisterResponseSchema.parse(raw) as DcrRegisterResponse;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mcpKeys.all }),
  });
}

/** Mint a provider login URL (backend spec 0061): the browser popup goes
 *  there, the provider redirects to the backend callback, and the sealed
 *  credential lands without the secret ever touching this client. */
export function useAuthorizeUrl() {
  return useMutation({
    mutationFn: async (input: AuthorizeUrlInput): Promise<AuthorizeUrlResponse> => {
      const raw = await apiClient<unknown>("/oauth/authorize-url", {
        method: "POST",
        body: JSON.stringify(authorizeUrlSchema.parse(input)),
      });
      return authorizeUrlResponseSchema.parse(raw);
    },
  });
}
