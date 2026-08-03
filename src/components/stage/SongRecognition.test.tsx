import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { STAGES } from "../../data/festival";
import { SongRecognition } from "./SongRecognition";

describe("SongRecognition crowd consensus", () => {
  it("surfaces a shared candidate and records an explicit fan confirmation", async () => {
    const confirmSong = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <SongRecognition
        stage={STAGES[0]}
        scheduledArtist="Labrinth"
        signal={{
          stageId: STAGES[0].id,
          title: "Never Felt So Alone",
          artists: ["Labrinth"],
          confirmations: 1,
          confirmed: false,
          updatedAt: Date.now(),
        }}
        confirmSong={confirmSong}
      />,
    );

    expect(screen.getByText("Never Felt So Alone")).toBeInTheDocument();
    expect(screen.getByText("1 person agrees")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "That’s playing" }));

    expect(confirmSong).toHaveBeenCalledWith(expect.objectContaining({
      title: "Never Felt So Alone",
      artists: ["Labrinth"],
    }));
    expect(screen.getByRole("button", { name: "You confirmed" })).toBeDisabled();
  });

  it("keeps confirmation retryable when the shared update fails", async () => {
    const confirmSong = vi.fn().mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();
    render(
      <SongRecognition
        stage={STAGES[0]}
        signal={{
          stageId: STAGES[0].id,
          title: "Never Felt So Alone",
          artists: ["Labrinth"],
          confirmations: 1,
          confirmed: false,
          updatedAt: Date.now(),
        }}
        confirmSong={confirmSong}
      />,
    );

    await user.click(screen.getByRole("button", { name: "That’s playing" }));

    expect(await screen.findByText("Confirmation did not send. Please try again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "That’s playing" })).toBeEnabled();
  });
});
