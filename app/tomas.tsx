// app/tomas.tsx
import { useEffect, useState } from "react";
import { View, Text, FlatList, Alert, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { Href } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../src/lib/firebase";
import { getUserById } from "../src/api/users";

import type { Medication, Toma } from "../src/types";
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
  const [medsById, setMedsById] = useState<Record<string, Medication>>({});

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

  useEffect(() => {
    let cancelled = false;

    async function loadMeds() {
      const medIds = Array.from(new Set(tomas.map((t) => t.medId))).filter(Boolean);
      const missing = medIds.filter((id) => !medsById[id]);
      if (!missing.length) return;

      const entries = await Promise.all(
        missing.map(async (medId) => {
          try {
            const snap = await getDoc(doc(db, "medications", medId));
            if (snap.exists()) {
              return [medId, { id: medId, ...(snap.data() as any) } as Medication] as const;
            }
          } catch {}
          return null;
        })
      );

      const filtered = entries.filter(Boolean) as Array<readonly [string, Medication]>;
      if (!filtered.length || cancelled) return;

      setMedsById((prev) => {
        const next = { ...prev };
        filtered.forEach(([id, med]) => {
          next[id] = med;
        });
        return next;
      });
    }

    loadMeds();
    return () => {
      cancelled = true;
    };
  }, [tomas, medsById]);

  useEffect(() => {
    const missing = tomas.filter(
      (t) =>
        !t.medName &&
        !t.medStrength &&
        !t.medForm &&
        Boolean(medsById[t.medId])
    );
    if (!missing.length) return;

    Promise.all(
      missing.map((t) => {
        const med = medsById[t.medId];
        if (!med) return Promise.resolve();
        const patch: Record<string, string> = {};
        if (med.name) patch.medName = med.name;
        if (med.strength) patch.medStrength = med.strength;
        if (med.form) patch.medForm = med.form;
        if (!Object.keys(patch).length) return Promise.resolve();
        return updateDoc(doc(db, "tomas", t.id), patch);
      })
    ).catch(() => {
      // no bloqueamos la UI si falla el backfill
    });
  }, [tomas, medsById]);

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
    <SafeAreaView style={[styles.container, { backgroundColor: Colors.background }]}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {patientId ? "Tomas del paciente" : "Mis tomas"}
        </Text>
        <Text style={styles.subtitle}>
          Revisa y confirma las tomas programadas.
        </Text>
      </View>

      <FlatList
        data={tomas}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No hay tomas.</Text>
        }
        renderItem={({ item }) => {
          const canConfirm = item.status === "DUE" || item.status === "PLANNED";
          const canShowConfirm = !patientId || userRole === "CAREGIVER";
          const med = medsById[item.medId];
          const medName = med?.name ?? item.medName ?? "—";
          const medStrength = med?.strength ?? item.medStrength;
          const medForm = med?.form ?? item.medForm;

          return (
            <Card>
              <Text style={styles.cardTitle}>
                {item.status} · {fmt(item.plannedAt)}
              </Text>

              <Text style={styles.cardText}>
                Medicación: {medName}
                {medStrength ? ` · ${medStrength}` : ""}
                {medForm ? ` · ${medForm}` : ""}
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
              ? (userRole === "FAMILY"
                  ? ({
                      pathname: "/family/patient/[id]",
                      params: { id: String(patientId) },
                    } as Href)
                  : ({
                      pathname: "/care/patient/[id]",
                      params: { id: String(patientId) },
                    } as Href))
              : ("/home" as Href)
          )
        }
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
