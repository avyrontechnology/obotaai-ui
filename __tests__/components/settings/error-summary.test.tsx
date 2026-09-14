import { render, screen, fireEvent } from "@testing-library/react";
import { useForm, FormProvider } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormErrorSummary, flattenErrors } from "@/components/settings/error-summary";

describe("flattenErrors", () => {
  it("flattens nested RHF errors depth-first with dotted paths", () => {
    const errors = {
      agent_name: { message: "Name must be at least 2 characters", type: "too_small" },
      agent_config: {
        llm: { model: { message: "Model is required", type: "invalid_type" } },
      },
    };
    expect(flattenErrors(errors)).toEqual([
      { path: "agent_name", message: "Name must be at least 2 characters" },
      { path: "agent_config.llm.model", message: "Model is required" },
    ]);
  });

  it("returns empty for no errors", () => {
    expect(flattenErrors({})).toEqual([]);
  });
});

const summarySchema = z.object({
  agent_name: z.string().min(2, "Name must be at least 2 characters"),
});

function SummaryHarness() {
  const methods = useForm({
    resolver: zodResolver(summarySchema),
    defaultValues: { agent_name: "" },
  });
  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(() => undefined)}>
        <FormErrorSummary />
        <input {...methods.register("agent_name")} id="agent_name" aria-label="Agent Name" />
        <button type="submit">Save</button>
      </form>
    </FormProvider>
  );
}

describe("FormErrorSummary", () => {
  it("renders nothing when the form has no errors", () => {
    render(<SummaryHarness />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows role=alert with a field link and focuses it on submit failure", async () => {
    render(<SummaryHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const summary = await screen.findByRole("alert");
    expect(summary).toBeInTheDocument();
    // Link targets the field id so keyboard users can jump to it.
    const link = screen.getByRole("link", { name: /Name must be at least 2 characters/ });
    expect(link).toHaveAttribute("href", "#agent_name");
    // Auto-focus lands on the summary for screen-reader announcement.
    expect(summary).toHaveFocus();
  });

  it("moves focus to the field when a summary link is activated", async () => {
    render(<SummaryHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const link = await screen.findByRole("link", { name: /Name must be at least 2 characters/ });
    fireEvent.click(link);
    expect(screen.getByLabelText("Agent Name")).toHaveFocus();
  });
});
