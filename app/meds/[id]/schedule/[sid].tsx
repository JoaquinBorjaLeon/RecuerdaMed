import { useEffect, useState } from "react";
import { View, Text, TextInput, Button, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../../src/lib/firebase";
import type { Schedule, SchedulePattern } from "../../../src/types";

function parseDate(input: string): string | null {
  const s = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

export default function EditSchedule() {
  const { id, sid } = useLocalSearchParams<{ id: string; sid: string }>();
  const router = useRouter();

  const [pattern, setPattern] = useState<SchedulePattern>("DAILY");
  const [times, setTimes] = useState("");
  const [dow, setDow] = useState("");
  const [every, setEvery] = useState("8");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [tol, setTol] = useState("30");

  useEffect(() => {
    (async () => {
      const snap = await getDoc(doc(db, "schedules", String(sid)));
      if (!snap.exists()) { Alert.alert("Error", "No existe la planificación"); router.back(); return; }
      const s = snap.data() as Schedule;
      setPattern(s.pattern);
      setStartDate(s.startDate);
      setEndDate(s.endDate ?? "");
      setTol(String(s.toleranceMinutes));
      if (s.times?.length) setTimes(s.times.join(","));
      if (s.dow?.length) setDow(s.dow.join(","));
      if (s.everyXHours) setEvery(String(s.everyXHours));
    })();
  }, [sid]);

  async function save() {
    const start = parseDate(startDate);
    const end = endDate.trim() ? parseDate(endDate) : null;
    if (!start) { Alert.alert("Fecha inicio inválida", "Usa YYYY-MM-DD o DD/MM/YYYY"); return; }
    if (endDate.trim() && !end) { Alert.alert("Fecha fin inválida", "Usa YYYY-MM-DD o DD/MM/YYYY"); return; }

    const patch: any = {
      startDate: start,
      endDate: end,
      toleranceMinutes: parseInt(tol) || 30,
      pattern,
      times: null, dow: null, everyXHours: null,
    };

    if (pattern === "DAILY" || pattern === "DOW") {
      const t = times.split(",").map(s => s.trim()).filter(Boolean);
      if (!t.length) { Alert.alert("Faltan horas", "Indica al menos una (HH:mm)"); return; }
      patch.times = t;
    }
    if (pattern === "DOW") {
      const d = dow.split(",").map(x => parseInt(x)).filter(n => n >= 1 && n <= 7);
      if (!d.length) { Alert.alert("Faltan días", "1=L … 7=D"); return; }
      patch.dow = d;
    }
    if (pattern === "EVERY_X_HOURS") {
      const n = parseInt(every);
      if (!n || n < 1) { Alert.alert("Intervalo inválido", "Indica un número ≥ 1"); return; }
      patch.everyXHours = n;
    }

    try {
      Object.keys(patch).forEach(k => patch[k] === null && delete patch[k]);
      await updateDoc(doc(db, "schedules", String(sid)), patch);
      Alert.alert("Listo", "Planificación actualizada");
      router.back();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo actualizar");
    }
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 10 }}>
      <Text style={{ fontSize: 20, fontWeight: "700" }}>Editar planificación</Text>

      <Text>Patrón (DAILY | DOW | EVERY_X_HOURS)</Text>
      <TextInput value={pattern} onChangeText={(v)=>setPattern(v as SchedulePattern)}
        style={{ borderWidth:1, borderRadius:8, padding:12 }} />

      {(pattern==='DAILY' || pattern==='DOW') && (
        <>
          <Text>Horas (coma): 08:00,20:00</Text>
          <TextInput value={times} onChangeText={setTimes}
            style={{ borderWidth:1, borderRadius:8, padding:12 }} />
        </>
      )}

      {pattern==='DOW' && (
        <>
          <Text>Días (1-7): 1=L … 7=D</Text>
          <TextInput value={dow} onChangeText={setDow}
            style={{ borderWidth:1, borderRadius:8, padding:12 }} />
        </>
      )}

      {pattern==='EVERY_X_HOURS' && (
        <>
          <Text>Cada X horas</Text>
          <TextInput value={every} onChangeText={setEvery} keyboardType="numeric"
            style={{ borderWidth:1, borderRadius:8, padding:12 }} />
        </>
      )}

      <Text>Inicio (YYYY-MM-DD o DD/MM/YYYY)</Text>
      <TextInput value={startDate} onChangeText={setStartDate}
        style={{ borderWidth:1, borderRadius:8, padding:12 }} />

      <Text>Fin (opcional)</Text>
      <TextInput value={endDate} onChangeText={setEndDate}
        style={{ borderWidth:1, borderRadius:8, padding:12 }} />

      <Text>Tolerancia ± minutos</Text>
      <TextInput value={tol} onChangeText={setTol} keyboardType="numeric"
        style={{ borderWidth:1, borderRadius:8, padding:12 }} />

      <Button title="Guardar cambios" onPress={save} />
      <Button title="Cancelar" onPress={() => router.back()} />
    </View>
  );
}
