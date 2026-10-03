import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  mcpKeys,
  useConnectCredential,
  useDcrRegister,
  useDeleteTemplate,
  useIntegrationTemplates,
  useLinkIntegration,
  usePartnerCredentials,
  usePartnerIntegrations,
  useRevokeCredential,
  useSaveTemplate,
  useSyncTools,
  useUnlinkIntegration,
} from "@/services/platform/mcp";
import { apiClient } from "@/lib/api-client";

jest.mock("@/lib/api-client", () => {
  const actual = jest.requireActual("@/lib/api-client");
  return { ...actual, apiClient: jest.fn() };
});

const mockedApiClient = apiClient as jest.Mock;

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateSpy = jest.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
  return { wrapper, invalidateSpy };
}

const TEMPLATE_ROW = {
  provider: "github",
  credential_type: "api_key",
  tools_template: [{ name: "create_issue" }],
  oauth_config: {},
  client_config: { timeout_s: 10 },
};

const CREDENTIAL_ROW = {
  id: "cred-1",
  provider: "github",
  credential_type: "api_key",
  key_version: 1,
  expires_at: null,
};

const LINK_ROW = {
  id: "link-1",
  provider: "github",
  agent_id: "agent-1",
  config: {},
  status: "active",
  negotiated_protocol_version: "",
};

describe("mcp provider hooks (backend spec 0058)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("exposes stable query keys", () => {
    expect(mcpKeys.all).toEqual(["mcp"]);
    expect(mcpKeys.templates).toEqual(["mcp", "templates"]);
    expect(mcpKeys.credentials).toEqual(["mcp", "credentials"]);
    expect(mcpKeys.integrations.all).toEqual(["mcp", "integrations"]);
    expect(mcpKeys.integrations.byAgent("agent-1")).toEqual([
      "mcp",
      "integrations",
      { agentId: "agent-1" },
    ]);
    expect(mcpKeys.integrations.byAgent()).toEqual(["mcp", "integrations", { agentId: null }]);
  });

  it("lists templates", async () => {
    const { wrapper } = setup();
    mockedApiClient.mockResolvedValue({ templates: [TEMPLATE_ROW] });
    const { result } = renderHook(() => useIntegrationTemplates(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApiClient).toHaveBeenCalledWith("/integration-templates");
    expect(result.current.data?.[0].provider).toBe("github");
    expect(result.current.data?.[0].tools_template).toHaveLength(1);
  });

  it("lists credential metadata with no ciphertext path", async () => {
    const { wrapper } = setup();
    // Even if the backend ever sent a ciphertext field, the read schema
    // strips unknown keys — the projection carries identifiers + expiry only.
    mockedApiClient.mockResolvedValue({
      credentials: [{ ...CREDENTIAL_ROW, encrypted_data: "MUST-NOT-LEAK" }],
    });
    const { result } = renderHook(() => usePartnerCredentials(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApiClient).toHaveBeenCalledWith("/partner-credentials");
    expect(result.current.data?.[0]).toEqual(CREDENTIAL_ROW);
    expect(result.current.data?.[0]).not.toHaveProperty("encrypted_data");
    expect(JSON.stringify(result.current.data)).not.toContain("MUST-NOT-LEAK");
  });

  it("connects with the exact body and returns the one-time secret", async () => {
    const { wrapper, invalidateSpy } = setup();
    mockedApiClient.mockResolvedValue({ ...CREDENTIAL_ROW, secret_once: "s3cr3t", replaced: false });
    const { result } = renderHook(() => useConnectCredential(), { wrapper });
    let connected: unknown;
    await React.act(async () => {
      connected = await result.current.mutateAsync({ provider: "github", secret: "s3cr3t" });
    });
    expect(mockedApiClient.mock.calls[0][0]).toBe("/partner-credentials");
    const body = JSON.parse((mockedApiClient.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ provider: "github", credential_type: "api_key", secret: "s3cr3t", auth_config: {} });
    expect(connected).toEqual({
      meta: CREDENTIAL_ROW,
      secret_once: "s3cr3t",
      replaced: false,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: mcpKeys.all });
  });

  it("revokes by id and invalidates", async () => {
    const { wrapper, invalidateSpy } = setup();
    mockedApiClient.mockResolvedValue({ state: "deleted" });
    const { result } = renderHook(() => useRevokeCredential(), { wrapper });
    let revoked: unknown;
    await React.act(async () => {
      revoked = await result.current.mutateAsync("cred-1");
    });
    expect(mockedApiClient).toHaveBeenCalledWith(
      "/partner-credentials/cred-1",
      expect.objectContaining({ method: "DELETE" })
    );
    expect(revoked).toBe("cred-1");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: mcpKeys.all });
  });

  it("lists links scoped by agent", async () => {
    const { wrapper } = setup();
    mockedApiClient.mockResolvedValue({ integrations: [LINK_ROW] });
    const { result } = renderHook(() => usePartnerIntegrations("agent-1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApiClient).toHaveBeenCalledWith("/partner-integrations?agent_id=agent-1");
    expect(result.current.data?.[0].agent_id).toBe("agent-1");
  });

  it("lists links without a query string when unfiltered", async () => {
    const { wrapper } = setup();
    mockedApiClient.mockResolvedValue({ integrations: [] });
    renderHook(() => usePartnerIntegrations(), { wrapper });
    await waitFor(() => expect(mockedApiClient).toHaveBeenCalled());
    expect(mockedApiClient).toHaveBeenCalledWith("/partner-integrations");
  });

  it("links with the exact body", async () => {
    const { wrapper, invalidateSpy } = setup();
    mockedApiClient.mockResolvedValue(LINK_ROW);
    const { result } = renderHook(() => useLinkIntegration(), { wrapper });
    let linked: unknown;
    await React.act(async () => {
      linked = await result.current.mutateAsync({ provider: "github", agent_id: "agent-1" });
    });
    expect(mockedApiClient.mock.calls[0][0]).toBe("/partner-integrations");
    const body = JSON.parse((mockedApiClient.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ provider: "github", agent_id: "agent-1", config: {} });
    expect(linked).toEqual(expect.objectContaining({ id: "link-1" }));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: mcpKeys.all });
  });

  it("unlinks by id and invalidates", async () => {
    const { wrapper, invalidateSpy } = setup();
    mockedApiClient.mockResolvedValue({ state: "deleted" });
    const { result } = renderHook(() => useUnlinkIntegration(), { wrapper });
    let unlinked: unknown;
    await React.act(async () => {
      unlinked = await result.current.mutateAsync("link-1");
    });
    expect(mockedApiClient).toHaveBeenCalledWith(
      "/partner-integrations/link-1",
      expect.objectContaining({ method: "DELETE" })
    );
    expect(unlinked).toBe("link-1");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: mcpKeys.all });
  });

  it("registers via DCR with the exact body and returns the one-time client secret", async () => {
    const { wrapper, invalidateSpy } = setup();
    mockedApiClient.mockResolvedValue({
      ...CREDENTIAL_ROW,
      client_id: "cid-1",
      issuer_url: "https://issuer.test",
      client_secret_once: "once-secret",
    });
    const { result } = renderHook(() => useDcrRegister(), { wrapper });
    let registered: unknown;
    await React.act(async () => {
      registered = await result.current.mutateAsync({
        issuer_url: "https://issuer.test",
        provider: "github",
      });
    });
    expect(mockedApiClient.mock.calls[0][0]).toBe("/integrations/dcr-register");
    const body = JSON.parse((mockedApiClient.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ issuer_url: "https://issuer.test", provider: "github" });
    expect(registered).toEqual(
      expect.objectContaining({ client_id: "cid-1", client_secret_once: "once-secret" })
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: mcpKeys.all });
  });

  it("saves a template with exact keys and surfaces the replaced flag", async () => {
    const { wrapper, invalidateSpy } = setup();
    mockedApiClient.mockResolvedValue({ ...TEMPLATE_ROW, replaced: false });
    const { result } = renderHook(() => useSaveTemplate(), { wrapper });
    let saved: unknown;
    await React.act(async () => {
      saved = await result.current.mutateAsync({ provider: "github" });
    });
    expect(mockedApiClient.mock.calls[0][0]).toBe("/integration-templates");
    const body = JSON.parse((mockedApiClient.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({
      provider: "github",
      credential_type: "api_key",
      transport: "http",
      tools_template: [],
      oauth_config: {},
      client_config: {},
    });
    expect(saved).toEqual(expect.objectContaining({ provider: "github", replaced: false }));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: mcpKeys.all });
  });

  it("deletes a template override by provider and invalidates", async () => {    const { wrapper, invalidateSpy } = setup();
    mockedApiClient.mockResolvedValue({ state: "deleted" });
    const { result } = renderHook(() => useDeleteTemplate(), { wrapper });
    let deleted: unknown;
    await React.act(async () => {
      deleted = await result.current.mutateAsync("github");
    });
    expect(mockedApiClient).toHaveBeenCalledWith(
      "/integration-templates/github",
      expect.objectContaining({ method: "DELETE" })
    );
    expect(deleted).toBe("github");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: mcpKeys.all });
  });

  it("syncs template tools and parses counts plus problems", async () => {
    const { wrapper, invalidateSpy } = setup();
    mockedApiClient.mockResolvedValue({
      created: 2,
      updated: 1,
      skipped: ["function:hand"],
      tool_ids: ["function:a", "function:b", "function:c"],
      problems: ["tools_template[3]: bad tool name"],
    });
    const { result } = renderHook(() => useSyncTools(), { wrapper });
    let synced: unknown;
    await React.act(async () => {
      synced = await result.current.mutateAsync("github");
    });
    expect(mockedApiClient).toHaveBeenCalledWith(
      "/integration-templates/github/sync-tools",
      expect.objectContaining({ method: "POST" })
    );
    expect(synced).toEqual(
      expect.objectContaining({ created: 2, skipped: ["function:hand"] })
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: mcpKeys.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["tools"] });
  });
});
