import { cn } from "@/lib/utils";

describe("cn util (F7 ownership)", () => {
  it("merges class names and resolves Tailwind conflicts", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-sm", false && "hidden", undefined, "font-bold")).toBe(
      "text-sm font-bold"
    );
  });

  it("handles conditional and array inputs", () => {
    expect(cn(["a", "b"], { c: true, d: false })).toBe("a b c");
  });
});
