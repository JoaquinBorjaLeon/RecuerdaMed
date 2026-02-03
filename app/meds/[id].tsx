import { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, Alert, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { Href } from "expo-router";
import { doc, getDoc } from "firebase/firestore";

import { db } from "../../src/lib/firebase";
import type { Medication, Schedule } from "../../src/types";
import { listenSchedulesByMed } from "../../src/api/schedules";
import { deleteMedication } from "../../src/api/meds";
import { canDeleteMedication } from "../../src/api/tomas";
import { PrimaryButton } from "../../src/components/primaryButton";

export default function MedDetail() {
  const { id, readonly, patientId } = useLocalSearchParams<{
    id: string;
    readonly?: string;
    patientId?: string;
  }>();
  const router = useRouter();

  const isReadOnly = readonly === "1" || readonly === "true";

  const [med, setMed] = useState<Medication | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [deleting, setDeleting] = useState(false);

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

    const unsub = listenSchedulesByMed(String(id), setSchedules);
    return () => unsub();
  }, [id]);

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
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      {med ? (
        <>
          <Text style={{ fontSize: 22, fontWeight: "700" }}>{med.name}</Text>
          {!!med.strength && <Text>{med.strength}</Text>}
          {!!med.form && <Text>{med.form}</Text>}
          {!!med.notes && <Text style={{ opacity: 0.7 }}>{med.notes}</Text>}

          <Text style={{ marginTop: 16, fontSize: 18, fontWeight: "700" }}>
            Planificaciones
          </Text>

          <FlatList
            data={schedules}
            keyExtractor={(i) => i.id}
            ListEmptyComponent={<Text>No hay planificaciones aún.</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/meds/[id]/schedule/[sid]",
                    params: {
                      id: String(id),
                      sid: item.id,
                      ...(isReadOnly ? { readonly: "1" } : {}),
                    },
                  })
                }
                style={{
                  padding: 12,
                  borderWidth: 1,
                  borderRadius: 8,
                  marginBottom: 8,
                }}
              >
                <Text>{renderSchedule(item)}</Text>
                <Text style={{ opacity: 0.7, marginTop: 4 }}>
                  Inicio: {item.startDate}
                  {item.endDate ? ` · Fin: ${item.endDate}` : ""}
                </Text>
              </TouchableOpacity>
            )}
          />

          {!isReadOnly && (
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/meds/[id]/schedule/new",
                  params: {
                    id,
                    ...(patientId ? { patientId } : {}),
                  },
                })
              }
              style={{
                backgroundColor: "#16a34a",
                padding: 14,
                borderRadius: 10,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>
                Nueva planificación
              </Text>
            </TouchableOpacity>
          )}

          {!isReadOnly && (
            <TouchableOpacity
              onPress={handleDelete}
              disabled={deleting}
              style={{
                backgroundColor: deleting ? "#991b1b" : "#dc2626",
                padding: 14,
                borderRadius: 10,
                alignItems: "center",
                marginTop: 12,
                opacity: deleting ? 0.7 : 1,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>
                {deleting ? "Eliminando..." : "Eliminar medicación"}
              </Text>
            </TouchableOpacity>
          )}

          <PrimaryButton
            title="Volver"
            onPress={() => router.back()}
          />
        </>
      ) : (
        <Text>Cargando…</Text>
      )}
    </View>
  );
}
