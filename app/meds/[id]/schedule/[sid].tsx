import { useCallback, useEffect, useState } from "react";
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
import type { Href } from "expo-router";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";
import { db } from "../../../../src/lib/firebase";
import type { Schedule, SchedulePattern } from "../../../../src/types";
import { deleteScheduleAndTomas } from "../../../../src/api/schedules";

/** Parsea fecha en formato YYYY-MM-DD o DD/MM/YYYY a YYYY-MM-DD */
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

/** Pantalla de edición/visualización de una planificación existente */
export default function EditSchedule() {
  const { id, sid, readonly, patientId } = useLocalSearchParams<{
    id: string;
    sid: string;
    readonly?: string;
    patientId?: string;
  }>();
  const router = useRouter();

  const isReadOnly = readonly === "1" || readonly === "true";

  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  const [pattern, setPattern] = useState<SchedulePattern>("DAILY");
  const [times, setTimes] = useState("");
  const [dow, setDow] = useState("");
  const [every, setEvery] = useState("8");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [tol, setTol] = useState("30");
  const [locked, setLocked] = useState(false);
  const [ownerPatientId, setOwnerPatientId] = useState<string | undefined>(patientId);

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

  const goToMed = useCallback(() => {
    router.replace({
      pathname: "/meds/[id]",
      params: {
        id: String(id),
        ...(isReadOnly ? { readonly: "1" } : {}),
        ...(patientId ? { patientId } : {}),
      },
    } as Href);
  }, [router, id, isReadOnly, patientId]);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "schedules", String(sid)));
        if (!snap.exists()) {
          Alert.alert("Error", "No existe la planificación");
          goToMed();
          return;
        }
        const s = snap.data() as Schedule;
        setOwnerPatientId(s.patientId ?? patientId);
        setPattern(s.pattern);
        setStartDate(s.startDate);
        setEndDate(s.endDate ?? "");
        setTol(String(s.toleranceMinutes ?? 30));
        if (s.times?.length) setTimes(s.times.join(","));
        else setTimes("");
        if (s.dow?.length) setDow(s.dow.join(","));
        else setDow("");
        if (s.everyXHours) setEvery(String(s.everyXHours));
        else setEvery("8");

        if (s.endDate) {
          const lastTomaSnap = await getDocs(
            query(
              collection(db, "tomas"),
              where("scheduleId", "==", String(sid)),
              orderBy("windowEnd", "desc"),
              limit(1)
            )
          );

          if (!lastTomaSnap.empty) {
            const last = lastTomaSnap.docs[0].data() as any;
            const lastWindowEnd = new Date(last.windowEnd);
            setLocked(new Date() > lastWindowEnd);
          } else {
            const [y, m, d] = s.endDate.split("-").map(Number);
            const endOfDay = new Date(y, m - 1, d, 23, 59, 59, 999);
            const tolMinutes = s.toleranceMinutes ?? 30;
            const endWithTolerance = new Date(
              endOfDay.getTime() + tolMinutes * 60000
            );
            setLocked(new Date() > endWithTolerance);
          }
        }
      } catch (e: any) {
        Alert.alert("Error", e?.message ?? "No se pudo cargar la planificación");
        goToMed();
      }
    })();
  }, [sid, patientId, goToMed]);

  async function save() {
    if (locked) {
      Alert.alert("No editable", "La planificación ya ha finalizado");
      return;
    }
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

    const patch: any = {
      startDate: start,
      endDate: end,
      toleranceMinutes: parseInt(tol) || 30,
      pattern,
      times: null,
      dow: null,
      everyXHours: null,
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
      patch.times = t;
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
      patch.dow = d;
    }

    if (pattern === "EVERY_X_HOURS") {
      const n = parseInt(every);
      if (!n || n < 1) {
        Alert.alert("Intervalo inválido", "Indica un número ≥ 1");
        return;
      }
      patch.everyXHours = n;
    }

    try {
      // Eliminar campos null para no sobrescribir datos existentes
      Object.keys(patch).forEach((k) => patch[k] === null && delete patch[k]);

      await updateDoc(doc(db, "schedules", String(sid)), patch);
      Alert.alert("Listo", "Planificación actualizada");
      goToMed();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo actualizar");
    }
  }

  async function handleDelete() {
    const confirmed =
      Platform.OS === "web"
        ? window.confirm("¿Eliminar esta planificación?")
        : await new Promise<boolean>((resolve) => {
            Alert.alert(
              "Eliminar planificación",
              "¿Seguro que quieres eliminar esta planificación?",
              [
                { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
                { text: "Eliminar", style: "destructive", onPress: () => resolve(true) },
              ]
            );
          });

    if (!confirmed) return;

    try {
      await deleteScheduleAndTomas(String(sid), ownerPatientId);
      if (Platform.OS === "web") {
        window.alert("Planificación eliminada");
        goToMed();
      } else {
        Alert.alert("OK", "Planificación eliminada", [
          {
            text: "Aceptar",
            onPress: () => goToMed(),
          },
        ]);
      }
    } catch (e: any) {
      const msg = e?.message ?? "No se pudo eliminar";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert("Error", msg);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, gap: 12, backgroundColor: bgColor }}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: textColor }}>
        Editar planificación
      </Text>

      {locked && (
        <Text style={{ color: textColor, fontWeight: "600" }}>
          Planificación completada
        </Text>
      )}

      <Text style={{ color: textColor }}>Patrón</Text>
      <TextInput
        value={pattern}
        onChangeText={(v) => setPattern(v as SchedulePattern)}
        placeholder="DAILY | DOW | EVERY_X_HOURS"
        placeholderTextColor={placeholderColor}
        style={inputStyle}
        editable={!locked && !isReadOnly}
      />

      {(pattern === "DAILY" || pattern === "DOW") && (
        <>
          <Text style={{ color: textColor }}>Horas (coma): ej. 08:00,20:00</Text>
          <TextInput
            value={times}
            onChangeText={setTimes}
            placeholder="08:00,20:00"
            placeholderTextColor={placeholderColor}
            style={inputStyle}
            editable={!locked && !isReadOnly}
          />
        </>
      )}

      {pattern === "DOW" && (
        <>
          <Text style={{ color: textColor }}>Días (1-7): 1=L … 7=D</Text>
          <TextInput
            value={dow}
            onChangeText={setDow}
            placeholder="1,2,3,4,5"
            placeholderTextColor={placeholderColor}
            style={inputStyle}
            editable={!locked && !isReadOnly}
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
            editable={!locked && !isReadOnly}
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
        editable={!locked && !isReadOnly}
      />

      <Text style={{ color: textColor }}>Fin (opcional)</Text>
      <TextInput
        value={endDate}
        onChangeText={setEndDate}
        placeholder="YYYY-MM-DD o DD/MM/YYYY"
        placeholderTextColor={placeholderColor}
        style={inputStyle}
        editable={!locked && !isReadOnly}
      />

      <Text style={{ color: textColor }}>Tolerancia ± minutos</Text>
      <TextInput
        value={tol}
        onChangeText={setTol}
        keyboardType="numeric"
        placeholder="30"
        placeholderTextColor={placeholderColor}
        style={inputStyle}
        editable={!locked && !isReadOnly}
      />

      {!locked && !isReadOnly && (
        <>
          <Button title="Guardar cambios" onPress={save} />
          <Button title="Eliminar planificación" color="#dc2626" onPress={handleDelete} />
        </>
      )}
      <Button title="Cancelar" onPress={() => goToMed()} />
    </SafeAreaView>
  );
}
