import { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { Href } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, where, orderBy } from "firebase/firestore";

import { auth, db } from "../../../src/lib/firebase";
import type { Medication } from "../../../src/types";
import { getUserById, UserProfile } from "../../../src/api/users";

import { Card } from "../../../src/components/card";
import { PrimaryButton } from "../../../src/components/primaryButton";
import { Colors } from "../../../src/theme/colors";

/** Detalle de un paciente visto desde el familiar (solo lectura) */
export default function FamilyPatientDetailScreen() {
  const router = useRouter();
  const { id: patientId } = useLocalSearchParams<{ id: string }>();

  const [patient, setPatient] = useState<UserProfile | null>(null);
  const [meds, setMeds] = useState<Medication[]>([]);

  useEffect(() => {
    if (!patientId) return;

    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.replace("/");
        return;
      }

      const profile = await getUserById(patientId);
      setPatient(profile);
    });

    return unsub;
  }, [patientId, router]);

  useEffect(() => {
    if (!patientId) return;

    const q = query(
      collection(db, "medications"),
      where("patientId", "==", patientId),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      })) as Medication[];

      setMeds(items);
    });

    return () => unsub();
  }, [patientId]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors.background }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{patient?.fullName ?? "Paciente"}</Text>

        {patient?.email && <Text style={styles.subtitle}>{patient.email}</Text>}
      </View>

      <Text style={styles.section}>Medicación activa</Text>

      <FlatList
        data={meds}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            Este paciente no tiene medicación.
          </Text>
        }
        renderItem={({ item }) => (
          <Card
            onPress={() =>
              router.push({
                pathname: "/meds/[id]",
                params: { id: item.id, readonly: "1", patientId },
              })
            }
          >
            <View style={styles.medRow}>
              {!!item.imageUrl && (
                <Image source={{ uri: item.imageUrl }} style={styles.medThumb} />
              )}
              <View style={styles.medInfo}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                {!!item.strength && <Text style={styles.cardText}>{item.strength}</Text>}
                {!!item.form && <Text style={styles.cardText}>{item.form}</Text>}
              </View>
            </View>
          </Card>
        )}
      />

      <Text style={styles.section}>Acciones</Text>
      <Card>
        <PrimaryButton
          title="Ver tomas del paciente"
          onPress={() =>
            router.push({
              pathname: "/tomas",
              params: { patientId },
            })
          }
        />
      </Card>

      <PrimaryButton title="Volver" onPress={() => router.replace("/family/patients" as Href)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: {
    marginBottom: 8,
  },
  title: { fontSize: 24, fontWeight: "800", color: Colors.text },
  subtitle: { color: Colors.muted, marginTop: 6 },
  section: { marginTop: 12, fontSize: 16, fontWeight: "700", color: Colors.text },
  listContent: { paddingBottom: 8 },
  emptyText: { color: Colors.muted },
  cardTitle: { fontWeight: "700", color: Colors.text },
  medRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  medInfo: {
    flex: 1,
  },
  medThumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: "#E5E7EB",
  },
  cardText: { color: Colors.muted },
});
