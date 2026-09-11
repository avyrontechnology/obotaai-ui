import { fireEvent, render, screen } from "@testing-library/react";
import { Activity } from "lucide-react";
import { CommandPalette, fuzzyScore } from "@/components/layout/command-palette";
import { FLAT_NAV_ITEMS, isNavActive } from "@/components/layout/nav-items";
import { resolveSettingsTab } from "@/app/settings/page";

jest.mock("@/services/api", () => ({
  useAgents: () => ({ data: [] }),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme: jest.fn() }),
}));

describe("app shell", () => {
  it("matches nav items including nested routes", () => {
    const agents = FLAT_NAV_ITEMS.find((item) => item.href === "/agents");
    expect(agents).toBeDefined();
    expect(isNavActive(agents!, "/agents/123")).toBe(true);
    expect(isNavActive({ label: "Home", href: "/", icon: Activity }, "/")).toBe(true);
    expect(isNavActive({ label: "Home", href: "/", icon: Activity }, "/agents")).toBe(false);
  });

  it("exposes every route exactly once", () => {
    const hrefs = FLAT_NAV_ITEMS.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const href of ["/", "/agents", "/calls", "/batches", "/playground", "/settings"]) {
      expect(hrefs).toContain(href);
    }
  });

  it("resolves settings tabs with fallback", () => {
    expect(resolveSettingsTab("general")).toBe("general");
    expect(resolveSettingsTab("security")).toBe("security");
    expect(resolveSettingsTab("billing")).toBe("general");
    expect(resolveSettingsTab("nope")).toBe("general");
    expect(resolveSettingsTab(null)).toBe("general");
  });

  it("fuzzyScore ranks prefix over substring over nothing", () => {
    expect(fuzzyScore("Billing", "bil")).toBeGreaterThan(fuzzyScore("Billing", "ill"));
    expect(fuzzyScore("Billing", "zzz")).toBe(0);
    expect(fuzzyScore("Billing", "")).toBe(1);
  });

  it("palette filters entries and selects with keyboard", () => {
    const onClose = jest.fn();
    render(<CommandPalette open onClose={onClose} />);
    fireEvent.change(screen.getByLabelText("Command palette search"), { target: { value: "bill" } });
    expect(screen.getByText("Billing")).toBeInTheDocument();
    expect(screen.queryByText("Graphs")).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByLabelText("Command palette search"), { key: "Enter" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("palette renders nothing when closed", () => {
    const { container } = render(<CommandPalette open={false} onClose={() => undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});
