import { useEffect, useState } from "react";
import {
  Text,
  TextInput,
  Button,
  Alert,
  Platform,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../../../src/lib/firebase";
import { createSchedule } from "../../../../src/api/schedules";
import type { SchedulePattern } from "../../../../src/types";

/** Formulario para crear una nueva planificación de medicación */
export default function NewSchedule() {
  const { id, patientId } = useLocalSearchParams<{
    id: string;
    patientId?: string;
  }>();

  const router = useRouter();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  const [uid, setUid] = useState<string | null>(null);

  const [pattern, setPattern] = useState<SchedulePattern>("DAILY");
  const [times, setTimes] = useState<string>("08:00,20:00");
  const [dow, setDow] = useState<string>("1,2,3,4,5");
  const [every, setEvery] = useState<string>("8");
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
  });
  const [endDate, setEndDate] = useState<string>("");
  const [tol, setTol] = useState<string>("30");

  const inputStyle = {
    borderWidth: 1,
    borderColor: isDark ? "#E5E7EB" : "#111827",
    borderRadius: 10,
    padding: 12,
    backgroundColor: isDark ? "#111827" : "#FFFFFF",
    color: isDark ? "#F9FAFB" : "#111827",
  } as const;

  const placeholderColor = isDark ? "#9CA3AF" : "#6B7280";
  const textColor = isDark ? "#F9FAFB" : "#111827";
  const bgColor = isDark ? "#0B1220" : "#FFFFFF";

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) router.replace("/");
      else setUid(u.uid);
    });
    return unsub;
  }, [router]);

  function parseDate(input: string): string | null {
    const s = input.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    return null;
  }

  function isValidTime(value: string) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  }

  function todayYMD() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  async function save() {
    if (!uid || !id) return;

    const start = parseDate(startDate);
    const end = endDate.trim() ? parseDate(endDate) : null;

    if (!start) {
      Alert.alert("Fecha inicio inválida", "Usa YYYY-MM-DD o DD/MM/YYYY");
      return;
    }
    if (endDate.trim() && !end) {
      Alert.alert("Fecha fin inválida", "Usa YYYY-MM-DD o DD/MM/YYYY");
      return;
    }

    const today = todayYMD();
    if (start < today) {
      Alert.alert("Fecha inicio inválida", "No puede ser anterior a hoy");
      return;
    }
    if (end && end < start) {
      Alert.alert("Fecha fin inválida", "No puede ser anterior al inicio");
      return;
    }

    const toleranceMinutes = parseInt(tol) || 30;

    const realPatientId = patientId ?? uid;

    const base: any = {
      medId: String(id),
      patientId: realPatientId,
      startDate: start,
      endDate: end,
      toleranceMinutes,
      pattern,
    };

    if (pattern === "DAILY" || pattern === "DOW") {
      const t = times.split(",").map((s) => s.trim()).filter(Boolean);
      if (!t.length) {
        Alert.alert("Faltan horas", "Indica al menos una (HH:mm)");
        return;
      }
      const invalid = t.find((x) => !isValidTime(x));
      if (invalid) {
        Alert.alert("Hora inválida", `Formato inválido: ${invalid}`);
        return;
      }
      base.times = t;
    }

    if (pattern === "DOW") {
      const d = dow
        .split(",")
        .map((x) => parseInt(x))
        .filter((n) => n >= 1 && n <= 7);
      if (!d.length) {
        Alert.alert("Faltan días", "1=L … 7=D");
        return;
      }
      base.dow = d;
    }

    if (pattern === "EVERY_X_HOURS") {
      const n = parseInt(every);
      if (!n || n < 1) {
        Alert.alert("Intervalo inválido", "Indica un número ≥ 1");
        return;
      }
      base.everyXHours = n;
    }

    try {
      await createSchedule(base);

      router.replace({
        pathname: "/meds/[id]",
        params: {
          id: String(id),
          ...(patientId ? { patientId } : {}),
        },
      });
    } catch (e: any) {
      if (Platform.OS === "web") {
        window.alert(e?.message ?? "No se pudo guardar");
      } else {
        Alert.alert("Error", e?.message ?? "No se pudo guardar");
      }
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, gap: 12, backgroundColor: bgColor }}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: textColor }}>
        Nueva planificación
      </Text>

      <Text style={{ color: textColor }}>Patrón</Text>
      <TextInput
        value={pattern}
        onChangeText={(v) => setPattern(v as SchedulePattern)}
        placeholder="DAILY | DOW | EVERY_X_HOURS"
        placeholderTextColor={placeholderColor}
        style={inputStyle}
      />

      {(pattern === "DAILY" || pattern === "DOW") && (
        <>
          <Text style={{ color: textColor }}>Horas (ej. 08:00,20:00)</Text>
          <TextInput
            value={times}
            onChangeText={setTimes}
            placeholder="08:00,20:00"
            placeholderTextColor={placeholderColor}
            style={inputStyle}
          />
        </>
      )}

      {pattern === "DOW" && (
        <>
          <Text style={{ color: textColor }}>Días (1=L … 7=D)</Text>
          <TextInput
            value={dow}
            onChangeText={setDow}
            placeholder="1,2,3,4,5"
            placeholderTextColor={placeholderColor}
            style={inputStyle}
          />
        </>
      )}

      {pattern === "EVERY_X_HOURS" && (
        <>
          <Text style={{ color: textColor }}>Cada X horas</Text>
          <TextInput
            value={every}
            onChangeText={setEvery}
            keyboardType="numeric"
            placeholder="8"
            placeholderTextColor={placeholderColor}
            style={inputStyle}
          />
        </>
      )}

      <Text style={{ color: textColor }}>Inicio</Text>
      <TextInput
        value={startDate}
        onChangeText={setStartDate}
        placeholder="YYYY-MM-DD o DD/MM/YYYY"
        placeholderTextColor={placeholderColor}
        style={inputStyle}
      />

      <Text style={{ color: textColor }}>Fin (opcional)</Text>
      <TextInput
        value={endDate}
        onChangeText={setEndDate}
        placeholder="YYYY-MM-DD o DD/MM/YYYY"
        placeholderTextColor={placeholderColor}
        style={inputStyle}
      />

      <Text style={{ color: textColor }}>Tolerancia (min)</Text>
      <TextInput
        value={tol}
        onChangeText={setTol}
        keyboardType="numeric"
        placeholder="30"
        placeholderTextColor={placeholderColor}
        style={inputStyle}
      />

      <Button title="Guardar" onPress={save} />
      <Button
        title="Cancelar"
        onPress={() =>
          router.replace({
            pathname: "/meds/[id]",
            params: {
              id: String(id),
              ...(patientId ? { patientId } : {}),
            },
          })
        }
      />
    </SafeAreaView>
  );
}
