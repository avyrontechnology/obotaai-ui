import { render, screen, fireEvent, act } from "@testing-library/react";
import { useForm, FormProvider } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  SelectInput,
  TextInput,
  firstErrorMessage,
  getFieldError,
} from "@/components/settings/form-controls";

const errors = {
  agent_name: { message: "Name must be at least 2 characters", type: "too_small" },
  agent_config: {
    llm: { model: { message: "Model is required", type: "invalid_type" } },
    conversation: {},
  },
};

describe("form error helpers", () => {
  it("reads nested errors by dotted path", () => {
    expect(getFieldError(errors, "agent_name")).toBe("Name must be at least 2 characters");
    expect(getFieldError(errors, "agent_config.llm.model")).toBe("Model is required");
    expect(getFieldError(errors, "agent_config.conversation.hangup_after_silence")).toBeUndefined();
    expect(getFieldError(errors, "missing.deep.path")).toBeUndefined();
    expect(getFieldError({}, "agent_name")).toBeUndefined();
  });

  it("returns the first message depth-first", () => {
    expect(firstErrorMessage(errors)).toBe("Name must be at least 2 characters");
    expect(firstErrorMessage({})).toBe("Please fix the highlighted fields.");
  });
});

const optionalFormSchema = z.object({
  reasoning_effort: z.enum(["low", "medium", "high"]).optional(),
  hangup_after_silence: z.number().int().optional(),
});

function OptionalForm({ onSubmit }: { onSubmit: (data: unknown) => void }) {
  const methods = useForm({
    resolver: zodResolver(optionalFormSchema),
    defaultValues: { reasoning_effort: undefined, hangup_after_silence: undefined },
  });
  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit((data) => onSubmit(data))}>
        <SelectInput
          name="reasoning_effort"
          label="Reasoning Effort"
          options={[{ label: "Low", value: "low" }]}
        />
        <TextInput name="hangup_after_silence" label="Hangup" type="number" />
        <button type="submit">Save</button>
      </form>
    </FormProvider>
  );
}

describe("optional field submission", () => {
  it("submits untouched optional select/number as undefined (never '' or NaN)", async () => {
    const onSubmit = jest.fn();
    render(<OptionalForm onSubmit={onSubmit} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    expect(onSubmit).toHaveBeenCalledWith({
      reasoning_effort: undefined,
      hangup_after_silence: undefined,
    });
  });

  it("submits a cleared number field as undefined instead of NaN", async () => {
    const onSubmit = jest.fn();
    render(<OptionalForm onSubmit={onSubmit} />);
    const input = screen.getByLabelText("Hangup") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "30" } });
    fireEvent.change(input, { target: { value: "" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    expect(onSubmit).toHaveBeenCalledWith({
      reasoning_effort: undefined,
      hangup_after_silence: undefined,
    });
  });

  it("still submits chosen values", async () => {
    const onSubmit = jest.fn();
    render(<OptionalForm onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText("Reasoning Effort"), { target: { value: "low" } });
    fireEvent.change(screen.getByLabelText("Hangup"), { target: { value: "20" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    expect(onSubmit).toHaveBeenCalledWith({ reasoning_effort: "low", hangup_after_silence: 20 });
  });
});
