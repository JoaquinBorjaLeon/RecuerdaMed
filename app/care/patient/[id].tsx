// app/care/patient/[id].tsx
import { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
} from "firebase/firestore";

import { auth, db } from "../../src/lib/firebase";
import type { Medication } from "../../src/types";
import { getUserById, UserProfile } from "../../src/api/users";

import { Card } from "../../src/components/card";
import { PrimaryButton } from "../../src/components/primaryButton";
import { Colors } from "../../src/theme/colors";

export default function PatientDetailScreen() {
  const router = useRouter();
  const { id: patientId } = useLocalSearchParams<{ id: string }>();

  const [patient, setPatient] = useState<UserProfile | null>(null);
  const [meds, setMeds] = useState<Medication[]>([]);

  useEffect(() => {
    if (!patientId) return;

    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.replace("/");
        return;
      }

      // 👤 Perfil del paciente
      const profile = await getUserById(patientId);
      setPatient(profile);

      // 💊 Medicaciones del paciente
      const q = query(
        collection(db, "medications"),
        where("patientId", "==", patientId),
        orderBy("createdAt", "desc")
      );

      const unsubMeds = onSnapshot(q, (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        })) as Medication[];

        setMeds(items);
      });

      return () => unsubMeds();
    });

    return () => unsubAuth();
  }, [patientId, router]);

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <Text style={styles.title}>{patient?.fullName ?? "Paciente"}</Text>

      {patient?.email && (
        <Text style={styles.subtitle}>{patient.email}</Text>
      )}

      <Text style={styles.section}>Medicación activa</Text>

      <FlatList
        data={meds}
        keyExtractor={(m) => m.id}
        ListEmptyComponent={
          <Text style={{ color: Colors.muted, marginTop: 20 }}>
            Este paciente no tiene medicación.
          </Text>
        }
        renderItem={({ item }) => (
          <Card
            onPress={() =>
              router.push({
                pathname: "/meds/[id]",
                params: { id: item.id },
              })
            }
          >
            <Text style={styles.cardTitle}>{item.name}</Text>
            {!!item.strength && (
              <Text style={styles.cardText}>{item.strength}</Text>
            )}
            {!!item.form && (
              <Text style={styles.cardText}>{item.form}</Text>
            )}
          </Card>
        )}
      />

      <PrimaryButton
        title="Añadir medicación"
        onPress={() =>
          router.push({
            pathname: "/meds/new",
            params: { patientId },
          })
        }
      />

      <PrimaryButton
        title="Ver tomas del paciente"
        onPress={() =>
          router.push({
            pathname: "/tomas",
            params: { patientId },
          })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.muted,
    marginBottom: 12,
  },
  section: {
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 8,
    marginTop: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
  },
  cardText: {
    color: Colors.muted,
    marginTop: 2,
  },
});
