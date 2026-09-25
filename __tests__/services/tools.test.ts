import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  toolKeys,
  useCreateTenantTool,
  useDeleteTenantTool,
  usePickerTools,
  useTools,
  useUpdateTenantTool,
} from "@/services/platform/tools";
import { apiClient, ApiError } from "@/lib/api-client";

jest.mock("@/lib/api-client", () => {
  const actual = jest.requireActual("@/lib/api-client");
  return { ...actual, apiClient: jest.fn() };
});

const mockedApiClient = apiClient as jest.Mock;

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
}

const SYSTEM_ROW = {
  tool_id: "function:calendar",
  kind: "function",
  name: "calendar",
  description: "Book.",
  parameters: {},
  url: "https://api.test/book",
  method: "POST",
  timeout_s: 10,
  deprecated: false,
  tenant_id: "system",
  created_at: "2026-09-03T00:00:00+00:00",
};

const DEPRECATED_ROW = {
  ...SYSTEM_ROW,
  tool_id: "function:legacy",
  name: "legacy",
  deprecated: true,
};

describe("tool registry hooks (spec 0029)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("exposes stable query keys", () => {
    expect(toolKeys.all).toEqual(["tools"]);
    expect(toolKeys.filtered("webhook")).toEqual(["tools", { kind: "webhook" }]);
    expect(toolKeys.filtered()).toEqual(["tools", { kind: null }]);
  });

  it("lists rows with the kind filter", async () => {
    mockedApiClient.mockResolvedValue({ tools: [SYSTEM_ROW] });
    const { result } = renderHook(() => useTools("function"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApiClient).toHaveBeenCalledWith("/tools?kind=function");
    expect(result.current.data?.[0].tool_id).toBe("function:calendar");
  });

  it("lists without a query string when unfiltered", async () => {
    mockedApiClient.mockResolvedValue({ tools: [] });
    renderHook(() => useTools(), { wrapper });
    await waitFor(() => expect(mockedApiClient).toHaveBeenCalled());
    expect(mockedApiClient).toHaveBeenCalledWith("/tools");
  });

  it("pickers hide deprecated rows (grandfathered rows still resolve by id)", async () => {
    mockedApiClient.mockResolvedValue({ tools: [SYSTEM_ROW, DEPRECATED_ROW] });
    const { result } = renderHook(() => usePickerTools(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((row) => row.tool_id)).toEqual(["function:calendar"]);
  });

  it("propagates 404s so the section can show the backend-missing notice", async () => {
    mockedApiClient.mockRejectedValue(new ApiError("Not Found", 404));
    const { result } = renderHook(() => useTools(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiError);
  });

  it("creates tenant rows without legacy keys", async () => {
    mockedApiClient.mockResolvedValue(SYSTEM_ROW);
    const { result } = renderHook(() => useCreateTenantTool(), { wrapper });
    let created: unknown;
    await React.act(async () => {
      created = await result.current.mutateAsync({ kind: "webhook", name: "notify" });
    });
    const body = JSON.parse((mockedApiClient.mock.calls[0][1] as RequestInit).body as string);
    expect(mockedApiClient.mock.calls[0][0]).toBe("/tools");
    expect(body.agent_id).toBeUndefined();
    expect(body.config).toBeUndefined();
    expect(body.kind).toBe("webhook");
    expect(created).toEqual(expect.objectContaining({ tool_id: "function:calendar" }));
  });

  it("updates and deletes by natural key", async () => {
    mockedApiClient.mockResolvedValue(SYSTEM_ROW);
    const { result: updater } = renderHook(() => useUpdateTenantTool(), { wrapper });
    await React.act(async () => {
      await updater.current.mutateAsync({ id: "function:calendar", input: { description: "New." } });
    });
    expect(mockedApiClient).toHaveBeenCalledWith(
      "/tools/function%3Acalendar",
      expect.objectContaining({ method: "PUT" })
    );

    const { result: deleter } = renderHook(() => useDeleteTenantTool(), { wrapper });
    let deleted: unknown;
    await React.act(async () => {
      deleted = await deleter.current.mutateAsync("function:calendar");
    });
    expect(mockedApiClient).toHaveBeenCalledWith(
      "/tools/function%3Acalendar",
      expect.objectContaining({ method: "DELETE" })
    );
    expect(deleted).toBe("function:calendar");
  });
});
