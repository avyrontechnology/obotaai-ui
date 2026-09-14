import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/services/api";
import { authKeys, useSession } from "@/services/auth";
import { batchKeys, useBatches } from "@/services/platform/batches";
import { executionKeys, useExecutions } from "@/services/platform/executions";
import { graphKeys } from "@/services/platform/graphs";
import { workflowKeys, campaignKeys } from "@/services/platform/workflows";
import { walletKeys } from "@/services/platform/wallet";
import { toolKeys } from "@/services/platform/tools";
import { voiceKeys } from "@/services/platform/voices";
import { webhookKeys } from "@/services/platform/webhooks";
import { apiKeyKeys } from "@/services/platform/api-keys";
import { kbKeys } from "@/services/platform/knowledgebases";
import { inboundKeys } from "@/services/platform/inbound";
import { integrationKeys } from "@/services/platform/integrations";
import { organizationKeys } from "@/services/platform/organization";
import { phoneNumberKeys } from "@/services/platform/phone-numbers";
import { subAccountKeys } from "@/services/platform/subaccounts";
import { templateKeys } from "@/services/platform/templates";

jest.mock("@/lib/api-client", () => ({
  apiClient: jest.fn(),
}));

const mockedApiClient = apiClient as jest.Mock;

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => jest.clearAllMocks());

describe("queryKeys shape (F7: invalidation complete)", () => {
  it("agents keys nest detail under the list prefix", () => {
    expect(queryKeys.agents.all).toEqual(["agents"]);
    expect(queryKeys.agents.detail("x")).toEqual(["agents", "x"]);
  });

  it("platform keys are namespaced and hierarchical", () => {
    expect(batchKeys.all).toEqual(["batches"]);
    expect(batchKeys.detail("b1")).toEqual(["batches", "b1"]);
    expect(executionKeys.all).toEqual(["executions"]);
    expect(executionKeys.detail("e1")).toEqual(["executions", "e1"]);
    expect(graphKeys.versions("g1")).toEqual(["graphs", "g1", "versions"]);
    expect(workflowKeys.versions("w1")).toEqual(["workflows", "w1", "versions"]);
    expect(campaignKeys.detail("c1")).toEqual(["workflow-campaigns", "c1"]);
    expect(walletKeys.balance).toEqual(["wallet"]);
    expect(walletKeys.ledger).toEqual(["wallet", "ledger"]);
    expect(toolKeys.filtered("a1")).toEqual(["agent-tools", { agent_id: "a1" }]);
    expect(voiceKeys.filtered("a1")).toEqual(["voices", { agent_id: "a1" }]);
    expect(webhookKeys.all).toEqual(["webhooks"]);
    expect(apiKeyKeys.all).toEqual(["api-keys"]);
    expect(kbKeys.vectorConfig("a1")).toEqual(["knowledgebases", "vector-config", "a1"]);
    expect(inboundKeys.detail("a1")).toEqual(["inbound", "a1"]);
    expect(integrationKeys.all).toEqual(["integrations"]);
    expect(organizationKeys.all).toEqual(["organization"]);
    expect(phoneNumberKeys.all).toEqual(["phone-numbers"]);
    expect(subAccountKeys.detail("s1")).toEqual(["sub-accounts", "s1"]);
    expect(templateKeys.detail("t1")).toEqual(["templates", "t1"]);
    expect(authKeys.session).toEqual(["auth", "session"]);
  });
});

describe("remote hooks use Query (no useEffect+fetch)", () => {
  it("useBatches hits /batches with an encoded agent filter", async () => {
    mockedApiClient.mockResolvedValue({ batches: [] });
    const { result } = renderHook(() => useBatches("agent 1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApiClient).toHaveBeenCalledWith("/batches?agent_id=agent%201");
  });

  it("useExecutions builds a filtered query string", async () => {
    mockedApiClient.mockResolvedValue({ executions: [] });
    const { result } = renderHook(() => useExecutions({ agent_id: "a1", limit: 5 }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [endpoint] = mockedApiClient.mock.calls[0] as [string];
    expect(endpoint).toContain("/executions");
    expect(endpoint).toContain("agent_id=a1");
    expect(endpoint).toContain("limit=5");
  });

  it("useSession parses via authMeSchema", async () => {
    mockedApiClient.mockResolvedValue({
      user: {
        user_id: "u1",
        email: "a@b.co",
        role: "admin",
        org_id: "o1",
        disabled: false,
        created_at: "2026-01-01",
      },
      scopes: ["agents:read"],
    });
    const { result } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApiClient).toHaveBeenCalledWith("/auth/me");
    expect(result.current.data?.user.role).toBe("admin");
  });
});
