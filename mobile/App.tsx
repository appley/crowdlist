import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Circle, Marker } from "react-native-maps";
import { SongIdentifier } from "./src/components/SongIdentifier";
import {
  countPresenceByStage,
  getFeaturedLineupSlot,
  getFreshPresence,
} from "./src/data/crowd";
import { createCrowdListDataSource } from "./src/data/http-data-source";
import type { Stage, StageOneSnapshot } from "./src/data/types";

const FESTIVAL_REGION = {
  latitude: 37.7698,
  longitude: -122.4867,
  latitudeDelta: 0.008,
  longitudeDelta: 0.014,
};

const REFRESH_INTERVAL_MS = 15_000;

function crowdColor(count: number, busiestCount: number) {
  const intensity = busiestCount === 0 ? 0 : count / busiestCount;
  if (intensity >= 0.67) return { fill: "rgba(255, 79, 55, 0.28)", stroke: "#e83e2b" };
  if (intensity >= 0.34) return { fill: "rgba(255, 190, 46, 0.3)", stroke: "#d99700" };
  return { fill: "rgba(66, 181, 96, 0.22)", stroke: "#2f8f49" };
}

export default function App() {
  const [snapshot, setSnapshot] = useState<StageOneSnapshot>({ stages: [], presence: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [selectedStage, setSelectedStage] = useState<Stage | null>(null);
  const [songIdentifierOpen, setSongIdentifierOpen] = useState(false);

  const loadSnapshot = useCallback(async () => {
    try {
      const nextSnapshot = await createCrowdListDataSource().getStageOneSnapshot();
      setSnapshot(nextSnapshot);
      setRefreshedAt(new Date());
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load crowd data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = setTimeout(() => void loadSnapshot(), 0);
    const interval = setInterval(() => void loadSnapshot(), REFRESH_INTERVAL_MS);
    return () => {
      clearTimeout(initialLoad);
      clearInterval(interval);
    };
  }, [loadSnapshot]);

  const freshPresence = useMemo(
    () => getFreshPresence(snapshot.presence, refreshedAt?.getTime() ?? 0),
    [snapshot.presence, refreshedAt],
  );
  const counts = useMemo(() => countPresenceByStage(freshPresence), [freshPresence]);
  const busiestCount = Math.max(0, ...snapshot.stages.map((stage) => counts.get(stage.id) ?? 0));

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <MapView style={StyleSheet.absoluteFill} initialRegion={FESTIVAL_REGION}>
        {freshPresence.map((item) => (
          <Circle
            key={item.userId}
            center={{ latitude: item.lat, longitude: item.lng }}
            radius={24}
            fillColor="rgba(255, 109, 85, 0.12)"
            strokeColor="rgba(255, 109, 85, 0.2)"
          />
        ))}
        {snapshot.stages.map((stage) => {
          const count = counts.get(stage.id) ?? 0;
          const color = crowdColor(count, busiestCount);
          return (
            <Circle
              key={stage.id}
              center={{ latitude: stage.lat, longitude: stage.lng }}
              radius={Math.min(155, 48 + count * 7)}
              fillColor={color.fill}
              strokeColor={color.stroke}
              strokeWidth={2}
            />
          );
        })}
        {snapshot.stages.map((stage) => {
          const featuredSlot = getFeaturedLineupSlot(
            stage.lineup,
            refreshedAt?.getTime() ?? 0,
          );
          return (
            <Marker
              key={stage.id}
              coordinate={{ latitude: stage.lat, longitude: stage.lng }}
              onPress={() => setSelectedStage(stage)}
            >
              <View style={[styles.marker, selectedStage?.id === stage.id && styles.markerSelected]}>
                <Text style={styles.markerCount}>{counts.get(stage.id) ?? 0}</Text>
                <Text numberOfLines={1} style={styles.markerName}>{stage.name}</Text>
                {featuredSlot ? (
                  <Text numberOfLines={2} style={styles.markerArtist}>
                    {featuredSlot.status} · {featuredSlot.artist}
                  </Text>
                ) : null}
              </View>
            </Marker>
          );
        })}
      </MapView>

      <SafeAreaView pointerEvents="box-none" style={styles.overlay}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>OUTSIDE LANDS 2026</Text>
            <Text style={styles.title}>Crowd heatmap</Text>
          </View>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        <View pointerEvents="none" style={styles.spacer} />

        <View style={styles.panel}>
          {loading ? (
            <View style={styles.statusRow}>
              <ActivityIndicator color="#171615" />
              <Text style={styles.statusText}>Loading festival crowds…</Text>
            </View>
          ) : error ? (
            <View>
              <Text style={styles.errorTitle}>Heatmap offline</Text>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable accessibilityRole="button" onPress={() => void loadSnapshot()} style={styles.retryButton}>
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.statusRow}>
                <Text style={styles.total}>{freshPresence.length}</Text>
                <View>
                  <Text style={styles.panelTitle}>people near stages</Text>
                  <Text style={styles.updatedText}>
                    Active in the last 2 min · refreshed {refreshedAt?.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </Text>
                </View>
              </View>
              <View style={styles.legend}>
                <Text style={styles.legendLabel}>Relative crowd</Text>
                <View style={[styles.legendDot, { backgroundColor: "#42b560" }]} />
                <Text style={styles.legendText}>Calm</Text>
                <View style={[styles.legendDot, { backgroundColor: "#ffbe2e" }]} />
                <Text style={styles.legendText}>Busy</Text>
                <View style={[styles.legendDot, { backgroundColor: "#ff4f37" }]} />
                <Text style={styles.legendText}>Packed</Text>
              </View>
              <Pressable
                disabled={!selectedStage}
                onPress={() => setSongIdentifierOpen(true)}
                style={[styles.songButton, !selectedStage && styles.songButtonDisabled]}
              >
                <Text style={styles.songButtonText}>
                  {selectedStage ? `Identify song at ${selectedStage.name}` : "Tap a stage marker to identify a song"}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </SafeAreaView>
      {songIdentifierOpen && selectedStage ? (
        <SongIdentifier
          onClose={() => setSongIdentifierOpen(false)}
          stage={selectedStage}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#e8e4d9", flex: 1 },
  overlay: { flex: 1, paddingHorizontal: 16, paddingBottom: 10 },
  header: {
    alignItems: "center",
    backgroundColor: "rgba(255, 253, 247, 0.94)",
    borderColor: "rgba(23, 22, 21, 0.14)",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  eyebrow: { color: "#69635d", fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  title: { color: "#171615", fontSize: 27, fontWeight: "800", letterSpacing: -1.1, marginTop: 2 },
  liveBadge: { alignItems: "center", backgroundColor: "#dfff36", borderRadius: 999, flexDirection: "row", gap: 6, paddingHorizontal: 11, paddingVertical: 8 },
  liveDot: { backgroundColor: "#2f8f49", borderRadius: 4, height: 8, width: 8 },
  liveText: { color: "#171615", fontSize: 11, fontWeight: "900", letterSpacing: 0.7 },
  spacer: { flex: 1 },
  panel: { backgroundColor: "rgba(255, 253, 247, 0.96)", borderColor: "rgba(23, 22, 21, 0.14)", borderRadius: 18, borderWidth: 1, padding: 17 },
  statusRow: { alignItems: "center", flexDirection: "row", gap: 13 },
  statusText: { color: "#171615", fontSize: 15, fontWeight: "700" },
  total: { color: "#171615", fontSize: 39, fontWeight: "900", letterSpacing: -2 },
  panelTitle: { color: "#171615", fontSize: 15, fontWeight: "800" },
  updatedText: { color: "#69635d", fontSize: 11, marginTop: 3 },
  legend: { alignItems: "center", borderTopColor: "#ded8cc", borderTopWidth: 1, flexDirection: "row", marginTop: 14, paddingTop: 12 },
  legendLabel: { color: "#69635d", fontSize: 10, fontWeight: "700", marginRight: "auto", textTransform: "uppercase" },
  legendDot: { borderRadius: 5, height: 10, marginLeft: 9, marginRight: 4, width: 10 },
  legendText: { color: "#69635d", fontSize: 10 },
  marker: { alignItems: "center", backgroundColor: "#171615", borderColor: "#fffdf7", borderRadius: 11, borderWidth: 2, maxWidth: 132, minWidth: 72, paddingHorizontal: 8, paddingVertical: 6 },
  markerSelected: { borderColor: "#dfff36", borderWidth: 3 },
  markerCount: { color: "#dfff36", fontSize: 16, fontWeight: "900" },
  markerName: { color: "white", fontSize: 9, fontWeight: "800", maxWidth: 112 },
  markerArtist: { color: "#dfff36", fontSize: 8, fontWeight: "700", marginTop: 2, maxWidth: 112, textAlign: "center" },
  errorTitle: { color: "#171615", fontSize: 17, fontWeight: "800" },
  errorText: { color: "#69635d", fontSize: 12, lineHeight: 17, marginTop: 5 },
  retryButton: { alignSelf: "flex-start", backgroundColor: "#171615", borderRadius: 999, marginTop: 12, paddingHorizontal: 15, paddingVertical: 9 },
  retryText: { color: "#dfff36", fontSize: 12, fontWeight: "800" },
  songButton: { alignItems: "center", backgroundColor: "#171615", borderRadius: 999, marginTop: 14, padding: 12 },
  songButtonDisabled: { backgroundColor: "#d8d2c7" },
  songButtonText: { color: "#dfff36", fontSize: 12, fontWeight: "900" },
});
