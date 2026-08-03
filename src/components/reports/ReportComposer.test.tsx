import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Stage } from "../../types";
import { ReportComposer } from "./ReportComposer";

const stage: Stage = {
  id: "sutro",
  name: "Sutro",
  zone: "Lindley Meadow",
  accent: "#ff7b3c",
  coordinates: [-122.4936, 37.77],
};

describe("ReportComposer", () => {
  it("submits two quick signals plus optional detail", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <ReportComposer stage={stage} anonId="anonymous_user_2026" onClose={onClose} onSubmit={onSubmit} />,
    );

    const submit = screen.getByRole("button", { name: "Send to the map" });
    expect(submit).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Getting busy" }));
    await user.click(screen.getByRole("button", { name: "Electric" }));
    await user.type(screen.getByRole("textbox"), "Room near the trees");
    await user.click(submit);

    expect(onSubmit).toHaveBeenCalledWith({
      stageId: "sutro",
      crowd: "busy",
      energy: "high",
      trend: "rising",
      text: "Room near the trees",
      anonId: "anonymous_user_2026",
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps the composer open and explains a failed submission", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error("offline"));
    const onClose = vi.fn();
    render(
      <ReportComposer stage={stage} anonId="anonymous_user_2026" onClose={onClose} onSubmit={onSubmit} />,
    );

    await user.click(screen.getByRole("button", { name: "Comfortable" }));
    await user.click(screen.getByRole("button", { name: "Buzzing" }));
    await user.click(screen.getByRole("button", { name: "Send to the map" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("didn’t send");
    expect(onClose).not.toHaveBeenCalled();
  });
});
