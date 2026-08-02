import { StatusBar } from "expo-status-bar";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";

export default function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>STAGE 1</Text>
        </View>
        <Text style={styles.title}>CrowdList</Text>
        <Text style={styles.subtitle}>The Expo Go scaffold is ready.</Text>
        <Text style={styles.body}>
          Data contracts and the swappable HTTP backend adapter are in place. Map,
          location, audio, song voting, and setlist screens intentionally begin only
          after Stage 1 approval.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: "#f5f0e6", flex: 1 },
  container: { flex: 1, justifyContent: "center", padding: 30 },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "#dfff36",
    borderColor: "#171615",
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  badgeText: { color: "#171615", fontSize: 11, fontWeight: "800", letterSpacing: 1.4 },
  title: { color: "#171615", fontSize: 58, fontWeight: "800", letterSpacing: -3 },
  subtitle: { color: "#171615", fontSize: 22, fontWeight: "700", marginTop: 10 },
  body: { color: "#69635d", fontSize: 16, lineHeight: 25, marginTop: 16 },
});
