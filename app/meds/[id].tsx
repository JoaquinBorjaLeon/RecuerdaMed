import { useEffect, useState } from "react";
import { View, Text, FlatList, Alert, Platform, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { Href } from "expo-router";
import { doc, getDoc } from "firebase/firestore";

import { db } from "../../src/lib/firebase";
import type { Medication, Schedule } from "../../src/types";
import { listenSchedulesByMed } from "../../src/api/schedules";
import { deleteMedication } from "../../src/api/meds";
import { canDeleteMedication } from "../../src/api/tomas";
import { PrimaryButton } from "../../src/components/primaryButton";
import { Card } from "../../src/components/card";
import { Colors } from "../../src/theme/colors";

export default function MedDetail() {
  const { id, readonly, patientId } = useLocalSearchParams<{
    id: string;
    readonly?: string;
    patientId?: string;
  }>();
  const router = useRouter();

  const [med, setMed] = useState<Medication | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [deleting, setDeleting] = useState(false);

  const isReadOnly = readonly === "1" || readonly === "true";
  const effectivePatientId = patientId;

  useEffect(() => {
    if (!id) return;

    (async () => {
      try {
        const snap = await getDoc(doc(db, "medications", String(id)));
        if (snap.exists()) {
          setMed({ id: snap.id, ...(snap.data() as any) });
        }
      } catch (e: any) {
        console.warn("getDoc medication error:", e?.code, e?.message, e);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const schedulePatientId = patientId ?? med?.patientId;
    if (!schedulePatientId) return;

    const unsub = listenSchedulesByMed(String(id), setSchedules, schedulePatientId);
    return () => unsub();
  }, [id, patientId, med?.patientId]);

  function renderSchedule(s: Schedule) {
    if (s.pattern === "DAILY") return `Diaria a ${s.times?.join(", ")}`;
    if (s.pattern === "DOW") {
      const map = ["L", "M", "X", "J", "V", "S", "D"];
      const dias = (s.dow || []).map((n) => map[n - 1]).join(",");
      return `Días ${dias} a ${s.times?.join(", ")}`;
    }
    return `Cada ${s.everyXHours}h desde ${s.startDate}${
      s.endDate ? ` hasta ${s.endDate}` : ""
    }`;
  }

async function handleDelete() {
  if (!med || deleting) return;
  setDeleting(true);

  const targetAfterDelete: Href = patientId
    ? ({
        pathname: "/care/patient/[id]",
        params: { id: String(patientId) },
      } as Href)
    : ("/home" as Href);

  try {
    const ok = await canDeleteMedication(med.id, med.patientId);
    if (!ok) {
      const msg = "No puedes eliminar: hay tomas futuras.";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert("No permitido", msg);
      setDeleting(false);
      return;
    }

    await deleteMedication(med.id);
    if (Platform.OS === "web") {
      window.alert("Medicación eliminada");
      router.replace(targetAfterDelete);
    } else {
      Alert.alert("OK", "Medicación eliminada", [
        {
          text: "Aceptar",
          onPress: () => router.replace(targetAfterDelete),
        },
      ]);
    }
  } catch (e: any) {
    const msg = e?.code ?? e?.message ?? "No se pudo eliminar";
    if (Platform.OS === "web") window.alert(msg);
    else Alert.alert("Error", msg);
  } finally {
    setDeleting(false);
  }
}


  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      {med ? (
        <>
          <Card>
            <Text style={styles.title}>{med.name}</Text>
            {!!med.strength && <Text style={styles.meta}>{med.strength}</Text>}
            {!!med.form && <Text style={styles.meta}>{med.form}</Text>}
            {!!med.notes && <Text style={styles.notes}>{med.notes}</Text>}
          </Card>

          <Text style={styles.sectionTitle}>Planificaciones</Text>

          <FlatList
            data={schedules}
            keyExtractor={(i) => i.id}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No hay planificaciones aún.</Text>
            }
            renderItem={({ item }) => (
              <Card
                onPress={() =>
                  router.push({
                    pathname: "/meds/[id]/schedule/[sid]",
                    params: {
                      id: String(id),
                      sid: item.id,
                      ...(isReadOnly ? { readonly: "1" } : {}),
                      ...(effectivePatientId ? { patientId: effectivePatientId } : {}),
                    },
                  })
                }
              >
                <Text style={styles.scheduleTitle}>{renderSchedule(item)}</Text>
                <Text style={styles.scheduleMeta}>
                  Inicio: {item.startDate}
                  {item.endDate ? ` · Fin: ${item.endDate}` : ""}
                </Text>
              </Card>
            )}
          />

          {!isReadOnly && (
            <PrimaryButton
              title="Nueva planificación"
              onPress={() =>
                router.push({
                  pathname: "/meds/[id]/schedule/new",
                  params: {
                    id,
                    ...(effectivePatientId ? { patientId: effectivePatientId } : {}),
                  },
                })
              }
            />
          )}

          {!isReadOnly && (
            <PrimaryButton
              title={deleting ? "Eliminando..." : "Eliminar medicación"}
              variant="danger"
              onPress={handleDelete}
            />
          )}

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
        </>
      ) : (
        <Text style={styles.loading}>Cargando…</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.text,
  },
  meta: {
    color: Colors.muted,
    marginTop: 2,
  },
  notes: {
    color: Colors.muted,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
    marginTop: 4,
  },
  emptyText: {
    color: Colors.muted,
  },
  scheduleTitle: {
    fontWeight: "700",
    color: Colors.text,
  },
  scheduleMeta: {
    color: Colors.muted,
    marginTop: 4,
  },
  loading: {
    color: Colors.muted,
  },
});
