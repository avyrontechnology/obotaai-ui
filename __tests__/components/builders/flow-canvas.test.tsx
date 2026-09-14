import { render, screen, fireEvent } from "@testing-library/react";
import { FlowCanvas } from "@/components/builders/flow-canvas";

function node(id: string) {
  return { id };
}

describe("FlowCanvas", () => {
  it("renders nodes with no nested interactive elements", () => {
    const onSelect = jest.fn();
    const onConnectClick = jest.fn();
    const onDelete = jest.fn();
    const { container } = render(
      <FlowCanvas
        nodes={[node("node-1"), node("node-2")]}
        edges={[{ from: "node-1", to: "node-2", label: "yes" }]}
        startId="node-1"
        selectedId="node-1"
        connectFrom={null}
        onSelect={onSelect}
        onConnectClick={onConnectClick}
        onDelete={onDelete}
        renderNode={(n) => <span>Card {n.id}</span>}
      />
    );
    // Delete is a real button sibling — never a span[role=button] inside a button.
    expect(container.querySelectorAll('span[role="button"]').length).toBe(0);
    const del = screen.getByRole("button", { name: "Delete node node-1" });
    expect(del.tagName).toBe("BUTTON");
    expect(del.className).toMatch(/cursor-pointer/);
    expect(del.className).toMatch(/focus-visible:ring/);
  });

  it("delete does not trigger connect and is keyboard accessible", () => {
    const onConnectClick = jest.fn();
    const onDelete = jest.fn();
    render(
      <FlowCanvas
        nodes={[node("node-1")]}
        edges={[]}
        selectedId="node-1"
        connectFrom={null}
        onSelect={jest.fn()}
        onConnectClick={onConnectClick}
        onDelete={onDelete}
        renderNode={(n) => <span>{n.id}</span>}
      />
    );
    const del = screen.getByRole("button", { name: "Delete node node-1" });
    fireEvent.click(del);
    expect(onDelete).toHaveBeenCalledWith("node-1");
    expect(onConnectClick).not.toHaveBeenCalled();
    del.focus();
    expect(del).toHaveFocus();
  });

  it("node buttons carry focus rings and connect pressed state", () => {
    const { container } = render(
      <FlowCanvas
        nodes={[node("a")]}
        edges={[]}
        selectedId={null}
        connectFrom="a"
        onSelect={jest.fn()}
        onConnectClick={jest.fn()}
        onDelete={jest.fn()}
        renderNode={(n) => <span>{n.id}</span>}
      />
    );
    const nodeBtn = container.querySelector('button[aria-pressed="true"]');
    expect(nodeBtn).not.toBeNull();
    expect(nodeBtn?.className).toMatch(/focus-visible:ring/);
    expect(nodeBtn?.className).toMatch(/cursor-pointer/);
  });

  it("shows empty hint on 375px scroll container", () => {
    const { container } = render(
      <FlowCanvas
        nodes={[]}
        edges={[]}
        selectedId={null}
        connectFrom={null}
        onSelect={jest.fn()}
        onConnectClick={jest.fn()}
        onDelete={jest.fn()}
        renderNode={() => null}
      />
    );
    expect(screen.getByText("Add your first node to begin.")).toBeInTheDocument();
    expect(container.firstChild as HTMLElement).toHaveClass("overflow-auto");
  });
});
