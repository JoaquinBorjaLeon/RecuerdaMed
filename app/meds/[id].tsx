import { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../src/lib/firebase";
import type { Medication, Schedule } from "../src/types";
import { listenSchedulesByMed } from "../src/api/schedules";

export default function MedDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [med, setMed] = useState<Medication | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const snap = await getDoc(doc(db, "medications", String(id)));
      if (snap.exists()) setMed({ id: snap.id, ...(snap.data() as any) });
    })();

    const unsub = listenSchedulesByMed(String(id), setSchedules);
    return () => unsub();
  }, [id]);

  function renderSchedule(s: Schedule) {
    if (s.pattern === "DAILY") return `Diaria a ${s.times?.join(", ")}`;
    if (s.pattern === "DOW") {
      const map = ["L","M","X","J","V","S","D"];
      const dias = (s.dow || []).map(n => map[(n - 1 + 7) % 7]).join(",");
      return `Días ${dias} a ${s.times?.join(", ")}`;
    }
    return `Cada ${s.everyXHours}h desde ${s.startDate}${s.endDate ? ` hasta ${s.endDate}` : ""}`;
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
                    params: { id: String(id), sid: item.id },
                  })
                }
                activeOpacity={0.7}
                style={{ padding: 12, borderWidth: 1, borderRadius: 8, marginBottom: 8 }}
              >
                <Text>{renderSchedule(item)}</Text>
                <Text style={{ opacity: 0.7, marginTop: 4 }}>
                  Inicio: {item.startDate}{item.endDate ? ` · Fin: ${item.endDate}` : ""}
                </Text>
              </TouchableOpacity>
            )}
          />

          <TouchableOpacity
            onPress={() => router.push(`/meds/${id}/schedule/new`)}
            style={{ backgroundColor: "#16a34a", padding: 14, borderRadius: 10, alignItems: "center" }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Nueva planificación</Text>
          </TouchableOpacity>
        </>
      ) : (
        <Text>Cargando…</Text>
      )}
    </View>
  );
}
