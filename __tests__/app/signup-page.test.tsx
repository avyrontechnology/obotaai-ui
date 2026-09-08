import { render, screen, fireEvent, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SignupPage from "@/app/signup/page";
import { ApiError } from "@/lib/api-client";

const push = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: jest.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

const mutateAsync = jest.fn();
jest.mock("@/services/auth", () => ({
  useSignup: () => ({ mutateAsync, isPending: false }),
}));

const queryClient = new QueryClient();

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <SignupPage />
    </QueryClientProvider>
  );
}

async function fillValid() {
  await act(async () => {
    fireEvent.change(screen.getByLabelText("EMAIL"), { target: { value: "owner@company.com" } });
    fireEvent.change(screen.getByLabelText("PASSWORD"), { target: { value: "s3cure-pass" } });
    fireEvent.change(screen.getByLabelText("CONFIRM PASSWORD"), { target: { value: "s3cure-pass" } });
  });
}

describe("Signup page", () => {
  beforeEach(() => {
    push.mockClear();
    mutateAsync.mockReset();
    (globalThis as unknown as { fetch: unknown }).fetch = jest.fn().mockRejectedValue(new Error("no backend"));
  });

  afterEach(() => {
    delete (globalThis as unknown as { fetch?: unknown }).fetch;
  });

  it("submits email/name/password without the confirm field and redirects", async () => {
    mutateAsync.mockResolvedValue({ user_id: "usr_1" });
    renderPage();
    await fillValid();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /create owner account/i }));
    });
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ email: "owner@company.com", password: "s3cure-pass" })
    );
    expect(push).toHaveBeenCalledWith("/");
  });

  it("points to sign-in when the workspace is already set up", async () => {
    mutateAsync.mockRejectedValue(new ApiError("Signup is closed — ask an admin for an invite", 403));
    renderPage();
    await fillValid();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /create owner account/i }));
    });
    expect(await screen.findByText("This workspace already has an owner.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });
});
