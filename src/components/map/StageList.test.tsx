import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { INITIAL_PULSES, STAGES } from "../../data/festival";
import { hasWebGl } from "../../lib/webgl";
import { StageList } from "./StageList";

describe("StageList", () => {
  it("reports no WebGL in a canvas-less environment", () => {
    expect(hasWebGl()).toBe(false);
  });

  it("lists every stage with a text-only pulse and selects one", async () => {
    const user = userEvent.setup();
    const onSelectStage = vi.fn();
    render(
      <StageList
        pulses={INITIAL_PULSES}
        selectedStageId="sutro"
        onSelectStage={onSelectStage}
      />,
    );

    expect(screen.getAllByRole("button")).toHaveLength(STAGES.length);
    const sutro = screen.getByRole("button", { name: /Sutro/ });
    expect(sutro).toHaveAttribute("aria-pressed", "true");
    expect(sutro).toHaveTextContent(/Now:|Between sets/);

    await user.click(screen.getByRole("button", { name: /Lands End/ }));
    expect(onSelectStage).toHaveBeenCalledWith("lands-end");
  });
});
