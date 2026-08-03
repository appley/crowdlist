import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ConnectedApp, FixtureApp } from "./App";

const convexUrl =
  import.meta.env.VITE_CONVEX_URL?.trim() || "https://agreeable-crane-771.convex.cloud";
const client = convexUrl ? new ConvexReactClient(convexUrl) : null;

class DataBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Live data unavailable; using fixtures.", error, info);
  }

  render() {
    return this.state.failed ? <FixtureApp degraded /> : this.props.children;
  }
}

export default function ClientApp() {
  const forceFixture = new URLSearchParams(window.location.search).get("fixture") === "1";

  if (!client || forceFixture) return <FixtureApp />;

  return (
    <DataBoundary>
      <ConvexProvider client={client}>
        <ConnectedApp />
      </ConvexProvider>
    </DataBoundary>
  );
}
