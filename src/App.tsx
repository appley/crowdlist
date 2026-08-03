import { useCallback, useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { AppShell } from "./components/AppShell";
import { INITIAL_PULSES } from "./data/festival";
import { applyFixtureReport } from "./lib/pulse";
import type { PresenceInput, ReportInput, SongConfirmationInput, SongRecognitionInput, SongRecognitionResponse, StagePulse } from "./types";

export function FixtureApp({ degraded = false }: { degraded?: boolean }) {
  const [pulses, setPulses] = useState<StagePulse[]>(INITIAL_PULSES);

  const submitReport = useCallback(async (input: ReportInput) => {
    await new Promise((resolve) => window.setTimeout(resolve, 280));
    setPulses((current) =>
      current.map((pulse) =>
        pulse.stageId === input.stageId
          ? applyFixtureReport(pulse, input.crowd, input.energy, input.trend)
          : pulse,
      ),
    );
  }, []);

  return (
    <AppShell
      pulses={pulses}
      status={degraded ? "degraded" : "fixture"}
      submitReport={submitReport}
    />
  );
}

export function ConnectedApp() {
  const bootstrap = useQuery(api.bootstrap.get);
  const ensureBootstrap = useMutation(api.bootstrap.ensure);
  const submitMutation = useMutation(api.reports.submit);
  const presenceMutation = useMutation(api.presence.ping);
  const confirmSongMutation = useMutation(api.songSignals.confirm);
  const identifySong = useAction(api.acrcloud.identify);

  useEffect(() => {
    if (bootstrap === null) void ensureBootstrap();
  }, [bootstrap, ensureBootstrap]);

  const submitReport = useCallback(
    async (input: ReportInput) => {
      await submitMutation(input);
    },
    [submitMutation],
  );

  const recognizeSong = useCallback(
    async (input: SongRecognitionInput) =>
      await identifySong(input) as SongRecognitionResponse,
    [identifySong],
  );

  const submitPresence = useCallback(
    async (input: PresenceInput) => {
      await presenceMutation(input);
    },
    [presenceMutation],
  );

  const confirmSong = useCallback(
    async (input: SongConfirmationInput) => {
      await confirmSongMutation(input);
    },
    [confirmSongMutation],
  );

  return (
    <AppShell
      pulses={(bootstrap?.pulses as StagePulse[] | undefined) ?? INITIAL_PULSES}
      presenceCells={bootstrap?.presenceCells ?? []}
      songSignals={bootstrap?.songSignals ?? []}
      status={bootstrap === undefined ? "connecting" : bootstrap === null ? "fixture" : "live"}
      submitReport={submitReport}
      submitPresence={submitPresence}
      recognizeSong={recognizeSong}
      confirmSong={confirmSong}
    />
  );
}
