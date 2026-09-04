import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { parseStoredPrompts, queryKeys, useAgent, useAgentPrompts } from "@/services/api";
import { apiClient } from "@/lib/api-client";

jest.mock("@/lib/api-client", () => ({
  apiClient: jest.fn(),
}));

const mockedApiClient = apiClient as jest.Mock;

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
}

describe("useAgent", () => {
  beforeEach(() => jest.clearAllMocks());

  it("exposes a dedicated detail query key", () => {
    expect(queryKeys.agents.detail("abc")).toEqual(["agents", "abc"]);
  });

  it("fetches GET /agent/:id and normalizes via toFrontendAgent", async () => {
    // Mirrors the real backend: raw Redis record with no agent_id and no
    // agent_prompts (prompts live in a separate file, no read endpoint).
    mockedApiClient.mockResolvedValue({
      agent_name: "Detail Agent",
      agent_type: "voice",
      agent_welcome_message: "Hi",
      assistant_status: "updated",
      tasks: [
        {
          tools_config: { llm_agent: { provider: "openai", model: "gpt-4o" } },
          toolchain: { execution: "parallel", pipelines: [["llm"]] },
          task_config: {},
        },
      ],
    });

    const { result } = renderHook(() => useAgent("agent-1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApiClient).toHaveBeenCalledWith("/agent/agent-1");
    expect(result.current.data?.agent_id).toBe("agent-1");
    expect(result.current.data?.agent_name).toBe("Detail Agent");
    expect(result.current.data?.agent_config.llm?.model).toBe("gpt-4o");
  });

  it("reads stored prompts via GET /agent/:id/prompts", async () => {
    mockedApiClient.mockResolvedValue({
      agent_id: "agent-1",
      agent_prompts: { task_1: { system_prompt: "You are support." } },
    });

    const { result } = renderHook(() => useAgentPrompts("agent-1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApiClient).toHaveBeenCalledWith("/agent/agent-1/prompts");
    expect(result.current.data?.system_prompt).toBe("You are support.");
  });

  it("stays disabled without an id", () => {
    const { result } = renderHook(() => useAgent("", false), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedApiClient).not.toHaveBeenCalled();
  });
});

describe("parseStoredPrompts", () => {
  it("parses the task_1 file shape", () => {
    expect(
      parseStoredPrompts({
        task_1: {
          system_prompt: "Be brief.",
          multilingual_prompts: { hi: { system_prompt: "Sankshep." } },
        },
      })
    ).toEqual({
      system_prompt: "Be brief.",
      multilingual_prompts: { hi: { system_prompt: "Sankshep." } },
    });
  });

  it("parses the flat seed shape", () => {
    expect(
      parseStoredPrompts({ system_prompt: "Flat prompt.", welcome_message: "Hi!" })
    ).toEqual({ system_prompt: "Flat prompt.", welcome_message: "Hi!" });
  });

  it("returns empty for null, missing, or malformed payloads", () => {
    expect(parseStoredPrompts(null)).toEqual({});
    expect(parseStoredPrompts(undefined)).toEqual({});
    expect(parseStoredPrompts("null")).toEqual({});
    expect(parseStoredPrompts({ task_1: "nope" })).toEqual({});
  });
});
