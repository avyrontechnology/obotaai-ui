import { toast } from "sonner";
import { ApiError } from "@/lib/api-client";
import { errorMessage, notify } from "@/lib/notify";

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    loading: jest.fn(),
    dismiss: jest.fn(),
  },
}));

const mockedToast = toast as unknown as Record<string, jest.Mock>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("errorMessage", () => {
  it("prefers the ApiError message", () => {
    expect(errorMessage(new ApiError("Batch is outside calling hours", 409))).toBe(
      "Batch is outside calling hours"
    );
  });

  it("falls back to generic Error text", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
  });

  it("handles unknown throwables", () => {
    expect(errorMessage("nope")).toBe("Something went wrong.");
    expect(errorMessage(undefined)).toBe("Something went wrong.");
  });
});

describe("notify", () => {
  it("forwards success with description", () => {
    notify.success("Saved", { description: "Agent updated" });
    expect(mockedToast.success).toHaveBeenCalledWith("Saved", { description: "Agent updated" });
  });

  it("attaches backend messages to errors", () => {
    const failure = new ApiError("Conflict", 409);
    notify.error("Deploy failed", failure);
    expect(mockedToast.error).toHaveBeenCalledWith("Deploy failed", { description: "Conflict" });
  });

  it("omits description when no error is given", () => {
    notify.error("Deploy failed");
    expect(mockedToast.error).toHaveBeenCalledWith("Deploy failed", { description: undefined });
  });
});
