import React, { Component, type ErrorInfo, type ReactNode } from "react";
import ReactDOM from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import "maplibre-gl/dist/maplibre-gl.css";
import { ConnectedApp, FixtureApp } from "./App";
import "./styles.css";

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

const convexUrl = import.meta.env.VITE_CONVEX_URL?.trim();
const forceFixture = new URLSearchParams(window.location.search).get("fixture") === "1";

const root = ReactDOM.createRoot(document.getElementById("root")!);

if (convexUrl && !forceFixture) {
  const client = new ConvexReactClient(convexUrl);
  root.render(
    <React.StrictMode>
      <DataBoundary>
        <ConvexProvider client={client}>
          <ConnectedApp />
        </ConvexProvider>
      </DataBoundary>
    </React.StrictMode>,
  );
} else {
  root.render(
    <React.StrictMode>
      <FixtureApp />
    </React.StrictMode>,
  );
}
