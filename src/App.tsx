import { useCallback, useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { AppShell } from "./components/AppShell";
import { INITIAL_PULSES } from "./data/festival";
import { applyFixtureReport } from "./lib/pulse";
import type { ReportInput, SongRecognitionInput, SongRecognitionResponse, StagePulse } from "./types";

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

  return (
    <AppShell
      pulses={(bootstrap?.pulses as StagePulse[] | undefined) ?? INITIAL_PULSES}
      status={bootstrap === undefined ? "connecting" : bootstrap === null ? "fixture" : "live"}
      submitReport={submitReport}
      recognizeSong={recognizeSong}
    />
  );
}
