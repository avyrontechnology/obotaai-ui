import { render, screen, fireEvent } from "@testing-library/react";
import { Mic } from "lucide-react";
import { RouteLoader } from "@/components/common/route-loader";
import { ErrorState } from "@/components/common/error-state";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { SkeletonList } from "@/components/common/skeleton-list";
import { Toggle } from "@/components/common/toggle";
import { ProgressBar } from "@/components/common/progress-bar";
import { Modal, Drawer } from "@/components/common/modal";
import { SearchInput } from "@/components/common/search-input";
import { fieldStyles } from "@/lib/field-styles";

describe("common primitives", () => {
  it("RouteLoader shows the label", () => {
    render(<RouteLoader label="Loading things..." />);
    expect(screen.getByText("Loading things...")).toBeInTheDocument();
  });

  it("ErrorState shows message and retry", () => {
    const onRetry = jest.fn();
    render(<ErrorState message="Boom." onRetry={onRetry} />);
    expect(screen.getByText("Boom.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("ErrorState omits retry when not provided", () => {
    render(<ErrorState message="Boom." />);
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("EmptyState renders icon, title and actions", () => {
    render(
      <EmptyState icon={Mic} title="Nothing here" description="Add one.">
        <button>Do it</button>
      </EmptyState>
    );
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Do it" })).toBeInTheDocument();
  });

  it("PageHeader renders title, accent and actions", () => {
    render(<PageHeader title="Neural" accent="Fleet" description="Sub." actions={<button>Go</button>} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Neural");
    expect(screen.getByText("Fleet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go" })).toBeInTheDocument();
  });

  it("SkeletonList renders the requested rows", () => {
    const { getAllByTestId } = render(<SkeletonList rows={4} />);
    expect(getAllByTestId("skeleton-row")).toHaveLength(4);
  });

  it("Toggle flips on click with accessible state", () => {
    const onChange = jest.fn();
    const { rerender } = render(<Toggle checked={false} onChange={onChange} label="Power" />);
    const toggle = screen.getByRole("switch", { name: "Power" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
    rerender(<Toggle checked={true} onChange={onChange} label="Power" />);
    expect(screen.getByRole("switch", { name: "Power" })).toHaveAttribute("aria-checked", "true");
  });

  it("ProgressBar clamps out-of-range values", () => {
    const { getByTestId, rerender } = render(<ProgressBar value={150} />);
    expect(getByTestId("progress-fill")).toHaveStyle({ width: "100%" });
    rerender(<ProgressBar value={-20} />);
    expect(getByTestId("progress-fill")).toHaveStyle({ width: "0%" });
  });

  it("Modal renders nothing when closed, dialog when open", () => {
    const { rerender } = render(
      <Modal open={false} onClose={() => undefined} label="Test">
        Body
      </Modal>
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    rerender(
      <Modal open onClose={() => undefined} label="Test" title="Title">
        Body
      </Modal>
    );
    expect(screen.getByRole("dialog", { name: "Test" })).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
  });

  it("Drawer renders aside dialog when open", () => {
    render(
      <Drawer open onClose={() => undefined} label="Panel">
        Content
      </Drawer>
    );
    expect(screen.getByRole("dialog", { name: "Panel" })).toBeInTheDocument();
  });

  it("SearchInput reports changes", () => {
    const onChange = jest.fn();
    render(<SearchInput value="" onChange={onChange} placeholder="Find..." />);
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "ab" } });
    expect(onChange).toHaveBeenCalledWith("ab");
  });

  it("fieldStyles exposes the canonical variants", () => {
    expect(Object.keys(fieldStyles).sort()).toEqual(["field", "fieldMuted", "fieldSm"]);
    for (const classes of Object.values(fieldStyles)) {
      expect(classes).toMatch("border-border");
      expect(classes).toMatch("focus:ring-ember-400/50");
    }
  });
});
