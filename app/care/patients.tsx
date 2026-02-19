// app/care/patients.tsx
import { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "../../src/lib/firebase";
import { getPatientsForCaregiver } from "../../src/api/careLinks";
import type { UserProfile } from "../../src/api/users";

import { Card } from "../../src/components/card";
import { PrimaryButton } from "../../src/components/primaryButton";
import { Colors } from "../../src/theme/colors";

export default function CaregiverPatientsScreen() {
  const router = useRouter();
  const [patients, setPatients] = useState<UserProfile[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.replace("/");
        return;
      }

      try {
        const data = await getPatientsForCaregiver(u.uid);
        setPatients(data);
      } catch (e) {
        console.warn("Error cargando pacientes:", e);
      }
    });

    return unsub;
  }, [router]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors.background }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Mis pacientes</Text>
        <Text style={styles.subtitle}>
          Accede rápidamente a la medicación y tomas.
        </Text>
      </View>

      <FlatList
        data={patients}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No tienes pacientes asignados.
          </Text>
        }
        renderItem={({ item }) => (
          <Card
            onPress={() =>
              router.push({
                pathname: "/care/patient/[id]",
                params: { id: item.id },
              })
            }
          >
            <Text style={styles.name}>{item.fullName}</Text>
            <Text style={styles.email}>{item.email}</Text>
          </Card>
        )}
      />

      <PrimaryButton
        title="Volver"
        onPress={() => router.replace("/home")}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: Colors.text,
  },
  subtitle: {
    marginTop: 6,
    color: Colors.muted,
  },
  listContent: {
    paddingBottom: 24,
  },
  emptyText: {
    color: Colors.muted,
    marginTop: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
  },
  email: {
    color: Colors.muted,
    marginTop: 2,
  },
});
