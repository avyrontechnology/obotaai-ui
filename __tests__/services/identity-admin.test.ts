import { fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  identityKeys,
  useCreateOrganization,
  useCreateTenant,
} from "@/services/platform/identity";
import { useSession } from "@/services/auth";
import { OrgIdentity } from "@/components/settings/org-identity";
import { apiClient, ApiError } from "@/lib/api-client";

jest.mock("@/lib/api-client", () => {
  const actual = jest.requireActual("@/lib/api-client");
  return { ...actual, apiClient: jest.fn() };
});

jest.mock("@/services/auth", () => ({
  useSession: jest.fn(),
}));

const mockedApiClient = apiClient as jest.Mock;
const mockedUseSession = useSession as jest.Mock;

function sessionFor(overrides: {
  role?: string;
  tenant_id?: string | null;
  org_id?: string;
} = {}) {
  const { role = "owner", tenant_id = "68d5f4a1b2c3d4e5f6071829", org_id = "org_1" } = overrides;
  return {
    data: {
      user: {
        user_id: "usr_owner",
        email: "owner@co.com",
        name: "Owner",
        role,
        org_id,
        tenant_id,
        disabled: false,
        created_at: "2026-01-01T00:00:00Z",
      },
      scopes: [],
    },
  };
}

function hookSetup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateSpy = jest.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
  return { invalidateSpy, wrapper };
}

function renderIdentity() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    React.createElement(QueryClientProvider, { client }, React.createElement(OrgIdentity))
  );
}

const TENANT_ROW = {
  tenant_id: "68d5f4a1b2c3d4e5f6071829",
  slug: "acme",
  name: "Acme Inc",
  plan: "default",
  status: "active",
};

const ORG_ROW = {
  org_id: "org_abc123def456",
  tenant_id: "68d5f4a1b2c3d4e5f6071829",
  name: "Acme EU",
};

describe("identity admin hooks (spec 0041 Slice A)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseSession.mockReturnValue(sessionFor());
  });

  it("creates tenants and invalidates the identity scope", async () => {
    mockedApiClient.mockResolvedValue(TENANT_ROW);
    const { invalidateSpy, wrapper } = hookSetup();
    const { result } = renderHook(() => useCreateTenant(), { wrapper });
    let created: unknown;
    await React.act(async () => {
      created = await result.current.mutateAsync({ slug: "acme", name: "Acme Inc" });
    });
    expect(mockedApiClient).toHaveBeenCalledWith(
      "/auth/tenants",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ slug: "acme", name: "Acme Inc" }),
      })
    );
    expect(created).toEqual(expect.objectContaining({ slug: "acme", status: "active" }));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: identityKeys.all });
  });

  it("surfaces 409 slug-taken on tenant create", async () => {
    mockedApiClient.mockRejectedValueOnce(new ApiError("Conflict", 409));
    const { wrapper } = hookSetup();
    const { result } = renderHook(() => useCreateTenant(), { wrapper });
    const failure = await React.act(async () =>
      result.current.mutateAsync({ slug: "acme", name: "Acme Inc" }).catch((e: unknown) => e)
    );
    expect((failure as ApiError).status).toBe(409);
  });

  it("creates organizations under the acting tenant and invalidates", async () => {
    mockedApiClient.mockResolvedValue(ORG_ROW);
    const { invalidateSpy, wrapper } = hookSetup();
    const { result } = renderHook(() => useCreateOrganization(), { wrapper });
    let created: unknown;
    await React.act(async () => {
      created = await result.current.mutateAsync({
        tenant_id: "68d5f4a1b2c3d4e5f6071829",
        name: "Acme EU",
      });
    });
    expect(mockedApiClient).toHaveBeenCalledWith(
      "/auth/organizations",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ tenant_id: "68d5f4a1b2c3d4e5f6071829", name: "Acme EU" }),
      })
    );
    expect(created).toEqual(expect.objectContaining({ org_id: "org_abc123def456" }));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: identityKeys.all });
  });

  it("surfaces 404 unknown-tenant on organization create", async () => {
    mockedApiClient.mockRejectedValueOnce(new ApiError("Not Found", 404));
    const { wrapper } = hookSetup();
    const { result } = renderHook(() => useCreateOrganization(), { wrapper });
    const failure = await React.act(async () =>
      result.current
        .mutateAsync({ tenant_id: "deadbeefdeadbeefdeadbeef", name: "Ghost" })
        .catch((e: unknown) => e)
    );
    expect((failure as ApiError).status).toBe(404);
  });
});

describe("OrgIdentity owner gating (spec 0041 Slice A)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows the tenant context and org form to owners, without a tenant switcher", () => {
    mockedUseSession.mockReturnValue(sessionFor());
    renderIdentity();
    expect(screen.getByText("68d5f4a1b2c3d4e5f6071829")).toBeInTheDocument();
    expect(screen.getByLabelText("New organization name")).toBeInTheDocument();
    expect(screen.queryByLabelText("New tenant slug")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByText(/switch tenant/i)).not.toBeInTheDocument();
  });

  it("exposes tenant creation only when no tenant context exists", () => {
    mockedUseSession.mockReturnValue(sessionFor({ tenant_id: null }));
    renderIdentity();
    expect(screen.getByText(/pre-identity/i)).toBeInTheDocument();
    expect(screen.getByLabelText("New tenant slug")).toBeInTheDocument();
    expect(screen.getByLabelText("New tenant name")).toBeInTheDocument();
  });

  it("hides both create forms from non-owners", () => {
    mockedUseSession.mockReturnValue(sessionFor({ role: "member" }));
    renderIdentity();
    expect(screen.getByText(/needs the owner role/)).toBeInTheDocument();
    expect(screen.queryByLabelText("New organization name")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("New tenant slug")).not.toBeInTheDocument();
  });

  it("renders the org form from the session tenant, never a picker", async () => {
    mockedUseSession.mockReturnValue(sessionFor());
    mockedApiClient.mockResolvedValue(ORG_ROW);
    renderIdentity();
    fireEvent.change(screen.getByLabelText("New organization name"), {
      target: { value: "Acme EU" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create organization" }));
    await waitFor(() =>
      expect(mockedApiClient).toHaveBeenCalledWith(
        "/auth/organizations",
        expect.objectContaining({
          body: JSON.stringify({ tenant_id: "68d5f4a1b2c3d4e5f6071829", name: "Acme EU" }),
        })
      )
    );
  });

  it("maps 409 slug-taken to inline copy", async () => {
    mockedUseSession.mockReturnValue(sessionFor({ tenant_id: null }));
    mockedApiClient.mockRejectedValueOnce(new ApiError("Conflict", 409));
    renderIdentity();
    fireEvent.change(screen.getByLabelText("New tenant slug"), { target: { value: "acme" } });
    fireEvent.change(screen.getByLabelText("New tenant name"), { target: { value: "Acme Inc" } });
    fireEvent.click(screen.getByRole("button", { name: "Create tenant" }));
    expect(await screen.findByText("Slug already taken — pick another.")).toBeInTheDocument();
  });

  it("maps 404 unknown-tenant to inline copy", async () => {
    mockedUseSession.mockReturnValue(sessionFor());
    mockedApiClient.mockRejectedValueOnce(new ApiError("Not Found", 404));
    renderIdentity();
    fireEvent.change(screen.getByLabelText("New organization name"), {
      target: { value: "Ghost" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create organization" }));
    expect(
      await screen.findByText("Unknown tenant — the acting tenant no longer exists.")
    ).toBeInTheDocument();
  });
});
