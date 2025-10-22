import { useEffect, useState } from "react";
import { View, Text, TextInput, Button, Alert, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../src/lib/firebase";
import { createSchedule } from "../src/api/schedules";
import type { SchedulePattern } from "../src/types";

export default function NewSchedule() {
  const { id } = useLocalSearchParams<{ id: string }>(); // medId
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);

  // form state
  const [pattern, setPattern] = useState<SchedulePattern>('DAILY');
  const [times, setTimes] = useState<string>("08:00,20:00");
  const [dow, setDow] = useState<string>("1,2,3,4,5"); // L..V
  const [every, setEvery] = useState<string>("8"); // horas
  const [startDate, setStartDate] = useState<string>("2025-10-22");
  const [endDate, setEndDate] = useState<string>("");
  const [tol, setTol] = useState<string>("30");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) router.replace("/");
      else setUid(u.uid);
    });
    return unsub;
  }, []);

  async function save() {
    if (!uid || !id) return;
    if (!startDate.match(/^\d{4}-\d{2}-\d{2}$/)) return Alert.alert("Fecha inválida", "Usa formato YYYY-MM-DD");
    const toleranceMinutes = parseInt(tol) || 30;

    const base = {
      medId: String(id),
      patientId: uid,
      startDate,
      endDate: endDate.trim() ? endDate.trim() : null,
      toleranceMinutes,
      pattern: pattern as SchedulePattern,
    } as any;

    if (pattern === 'DAILY') {
      const t = times.split(",").map(s => s.trim()).filter(Boolean);
      if (!t.length) return Alert.alert("Faltan horas", "Indica al menos una hora (HH:mm).");
      base.times = t;
    } else if (pattern === 'DOW') {
      const t = times.split(",").map(s => s.trim()).filter(Boolean);
      const d = dow.split(",").map(x => parseInt(x)).filter(n => n>=1 && n<=7);
      if (!t.length || !d.length) return Alert.alert("Faltan datos", "Indica horas y días (1=L ... 7=D).");
      base.times = t; base.dow = d;
    } else if (pattern === 'EVERY_X_HOURS') {
      const n = parseInt(every);
      if (!n || n<1) return Alert.alert("Intervalo inválido", "Indica un número de horas válido.");
      base.everyXHours = n;
    }

    try {
      await createSchedule(base);
      Alert.alert("Listo", "Planificación guardada");
      router.back();
    } catch (e:any) {
      Alert.alert("Error", e?.message ?? "No se pudo guardar");
    }
  }

  return (
    <View style={{ flex:1, padding:16, gap:10 }}>
      <Text style={{ fontSize:20, fontWeight:"700" }}>Nueva planificación</Text>

      {/* selector simple (texto) — luego lo mejoramos con UI bonita */}
      <Text style={{ marginTop:8 }}>Patrón (DAILY | DOW | EVERY_X_HOURS):</Text>
      <TextInput value={pattern} onChangeText={(v)=>setPattern(v as SchedulePattern)}
        placeholder="DAILY | DOW | EVERY_X_HOURS"
        style={{ borderWidth:1, borderRadius:8, padding:12 }} />

      {(pattern==='DAILY' || pattern==='DOW') && (
        <>
          <Text>Horas (coma): ej. 08:00,20:00</Text>
          <TextInput value={times} onChangeText={setTimes}
            style={{ borderWidth:1, borderRadius:8, padding:12 }} />
        </>
      )}

      {pattern==='DOW' && (
        <>
          <Text>Días (1-7, coma) — 1=L, 7=D</Text>
          <TextInput value={dow} onChangeText={setDow}
            style={{ borderWidth:1, borderRadius:8, padding:12 }} />
        </>
      )}

      {pattern==='EVERY_X_HOURS' && (
        <>
          <Text>Cada X horas (número)</Text>
          <TextInput value={every} onChangeText={setEvery} keyboardType="numeric"
            style={{ borderWidth:1, borderRadius:8, padding:12 }} />
        </>
      )}

      <Text>Inicio (YYYY-MM-DD)</Text>
      <TextInput value={startDate} onChangeText={setStartDate}
        style={{ borderWidth:1, borderRadius:8, padding:12 }} />

      <Text>Fin (opcional, YYYY-MM-DD)</Text>
      <TextInput value={endDate} onChangeText={setEndDate}
        style={{ borderWidth:1, borderRadius:8, padding:12 }} />

      <Text>Tolerancia ± minutos</Text>
      <TextInput value={tol} onChangeText={setTol} keyboardType="numeric"
        style={{ borderWidth:1, borderRadius:8, padding:12 }} />

      <Button title="Guardar" onPress={save} />
      <Button title="Cancelar" onPress={() => router.back()} />
    </View>
  );
}
