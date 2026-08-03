import { getCrowdListRepository } from "../lib/data/d1-repository";
import { CrowdListWebApp } from "./components/CrowdListWebApp";

export const dynamic = "force-dynamic";

const INITIAL_DEMO_NOW = Date.parse("2026-08-07T12:00:00-07:00");

export default async function Home() {
  const snapshot = await getCrowdListRepository().getStageOneSnapshot();
  return <CrowdListWebApp initialNow={INITIAL_DEMO_NOW} initialSnapshot={snapshot} />;
}
