import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { useMounted } from "@/lib/use-mounted";

function Probe() {
  const mounted = useMounted();
  return <span>{mounted ? "client" : "server"}</span>;
}

describe("useMounted", () => {
  it("renders the server snapshot during SSR and true on the client", () => {
    expect(renderToString(<Probe />)).toContain("server");
    render(<Probe />);
    expect(screen.getByText("client")).toBeInTheDocument();
  });
});
