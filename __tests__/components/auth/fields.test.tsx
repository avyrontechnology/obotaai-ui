import { render, screen, fireEvent } from "@testing-library/react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AuthAlert, AuthField, AuthPasswordField, AuthSubmitButton } from "@/components/auth/fields";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

function Harness({ onSubmit }: { onSubmit: (data: unknown) => void }) {
  const methods = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });
  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit((data) => onSubmit(data))} noValidate>
        <AuthField name="email" label="EMAIL" type="email" />
        <AuthPasswordField name="password" label="PASSWORD" />
        <AuthSubmitButton loading={false}>Go</AuthSubmitButton>
      </form>
    </FormProvider>
  );
}

describe("auth field kit", () => {
  it("associates errors with inputs via describedby/invalid", async () => {
    const onSubmit = jest.fn();
    render(<Harness onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: "Go" }));

    const emailError = await screen.findByText("Enter a valid email");
    const emailInput = screen.getByLabelText("EMAIL") as HTMLInputElement;
    expect(emailInput).toHaveAttribute("aria-invalid", "true");
    expect(emailInput.getAttribute("aria-describedby")).toBe(emailError.getAttribute("id"));
    expect(emailError).toHaveAttribute("role", "alert");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("toggles password visibility with an accessible label", () => {
    render(<Harness onSubmit={jest.fn()} />);
    const input = screen.getByLabelText("PASSWORD") as HTMLInputElement;
    expect(input).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(input).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toBeInTheDocument();
  });

  it("submits valid values", async () => {
    const onSubmit = jest.fn();
    render(<Harness onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText("EMAIL"), { target: { value: "a@b.co" } });
    fireEvent.change(screen.getByLabelText("PASSWORD"), { target: { value: "long-enough-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    await screen.findByText("Go");
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ email: "a@b.co", password: "long-enough-1" })
    );
  });

  it("renders form alerts with role=alert", () => {
    render(<AuthAlert message="Boom." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Boom.");
  });
});
