// app/tomas.tsx
import { useEffect, useState } from "react";
import { View, Text, FlatList, Alert, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { Href } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../src/lib/firebase";
import { getUserById } from "../src/api/users";

import type { Toma } from "../src/types";
import { listenUpcomingTomas, confirmToma } from "../src/api/tomas";

import { Card } from "../src/components/card";
import { PrimaryButton } from "../src/components/primaryButton";
import { Colors } from "../src/theme/colors";

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TomasScreen() {
  const router = useRouter();
  const { patientId, tomaId } = useLocalSearchParams<{ patientId?: string; tomaId?: string }>();
  const [tomas, setTomas] = useState<Toma[]>([]);
  const [userRole, setUserRole] = useState<"PATIENT" | "CAREGIVER" | "FAMILY" | null>(null);

  useEffect(() => {
    let unsubTomas: null | (() => void) = null;

    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.replace("/");
        return;
      }

      const profile = await getUserById(u.uid);
      setUserRole(profile?.role ?? null);

      if (unsubTomas) {
        unsubTomas();
        unsubTomas = null;
      }

      const targetPatientId = patientId ?? u.uid;
      unsubTomas = listenUpcomingTomas(String(targetPatientId), (items) => {
        if (tomaId) {
          const selected = items.find((t) => t.id === tomaId);
          const rest = items.filter((t) => t.id !== tomaId);
          setTomas(selected ? [selected, ...rest] : items);
        } else {
          setTomas(items);
        }
      });
    });

    return () => {
      if (unsubTomas) unsubTomas();
      unsubAuth();
    };
  }, [router, patientId]);

  async function handleConfirm(toma: Toma) {
    if (patientId && userRole !== "CAREGIVER") return;
    try {
      await confirmToma(toma.id, toma);
      // refresco automático por onSnapshot
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo confirmar la toma");
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <Text style={styles.title}>
        {patientId ? "Tomas del paciente" : "Mis tomas"}
      </Text>

      <FlatList
        data={tomas}
        keyExtractor={(t) => t.id}
        ListEmptyComponent={
          <Text style={{ color: Colors.muted }}>No hay tomas.</Text>
        }
        renderItem={({ item }) => {
          const canConfirm = item.status === "DUE" || item.status === "PLANNED";
          const canShowConfirm = !patientId || userRole === "CAREGIVER";

          return (
            <Card>
              <Text style={styles.cardTitle}>
                {item.status} · {fmt(item.plannedAt)}
              </Text>

              <Text style={styles.cardText}>
                Ventana: {fmt(item.windowStart)} — {fmt(item.windowEnd)}
              </Text>

              {canShowConfirm && (
                <PrimaryButton
                  title="Confirmar toma"
                  onPress={() => handleConfirm(item)}
                  disabled={!canConfirm}
                />
              )}
            </Card>
          );
        }}
      />

      <PrimaryButton
        title="Volver"
        onPress={() =>
          router.replace(
            patientId
              ? ({
                  pathname: "/care/patient/[id]",
                  params: { id: String(patientId) },
                } as Href)
              : ("/home" as Href)
          )
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
    marginBottom: 12,
  },
  cardTitle: {
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 6,
  },
  cardText: {
    color: Colors.muted,
    marginBottom: 8,
  },
});
