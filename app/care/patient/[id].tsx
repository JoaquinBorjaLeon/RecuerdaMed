import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
} from "firebase/firestore";

import { auth, db } from "../../../src/lib/firebase";
import type { Medication } from "../../../src/types";
import { getUserById, UserProfile } from "../../../src/api/users";
import { removeCareLink } from "../../../src/api/careLinks";

import { Card } from "../../../src/components/card";
import { PrimaryButton } from "../../../src/components/primaryButton";
import { Colors } from "../../../src/theme/colors";

export default function PatientDetailScreen() {
  const router = useRouter();
  const { id: patientId } = useLocalSearchParams<{ id: string }>();

  const [patient, setPatient] = useState<UserProfile | null>(null);
  const [meds, setMeds] = useState<Medication[]>([]);

  /* =====================
     AUTH + PROFILE
  ====================== */
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

  /* =====================
     MEDICATIONS LISTENER
  ====================== */
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

  /* =====================
     LEAVE PATIENT
  ====================== */
  async function handleLeave() {
    const uid = auth.currentUser?.uid;
    if (!uid || !patientId) return;

    try {
      await removeCareLink(uid, patientId);
      router.replace("/home");
    } catch (e: any) {
      if (Platform.OS === "web") {
        window.alert(e?.message ?? "No se pudo dejar de cuidar al paciente");
      } else {
        Alert.alert(
          "Error",
          e?.message ?? "No se pudo dejar de cuidar al paciente"
        );
      }
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <Text style={styles.title}>{patient?.fullName ?? "Paciente"}</Text>

      {patient?.email && (
        <Text style={styles.subtitle}>{patient.email}</Text>
      )}

      <Text style={styles.section}>Medicación</Text>

      <FlatList
        data={meds}
        keyExtractor={(m) => m.id}
        ListEmptyComponent={
          <Text style={{ color: Colors.muted }}>
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

      <PrimaryButton
        title="Dejar de cuidar a este paciente"
        variant="danger"
        onPress={handleLeave}
      />

      <PrimaryButton
        title="Volver"
        onPress={() => router.replace("/care/patients")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: "700", color: Colors.text },
  subtitle: { fontSize: 14, color: Colors.muted, marginBottom: 12 },
  section: {
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 8,
    marginTop: 16,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: Colors.text },
  cardText: { color: Colors.muted, marginTop: 2 },
});
