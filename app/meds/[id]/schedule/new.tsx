import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../../../src/lib/firebase";
import { createSchedule } from "../../../../src/api/schedules";
import type { SchedulePattern } from "../../../../src/types";
import { Colors } from "../../../../src/theme/colors";
import { Card } from "../../../../src/components/card";
import { PrimaryButton } from "../../../../src/components/primaryButton";
import { DatePickerField } from "../../../../src/components/datePickerField";

/** Etiquetas en español para los patrones de planificación */
const PATTERN_OPTIONS: { value: SchedulePattern; label: string; desc: string }[] = [
  { value: "DAILY", label: "Diaria", desc: "Todos los días a las mismas horas" },
  { value: "DOW", label: "Días de la semana", desc: "Solo ciertos días de la semana" },
  { value: "EVERY_X_HOURS", label: "Cada X horas", desc: "Repetir cada intervalo de horas" },
];

/** Días de la semana: 1=Lunes, 7=Domingo */
const DOW_LABELS = [
  { value: 1, label: "L" },
  { value: 2, label: "M" },
  { value: 3, label: "X" },
  { value: 4, label: "J" },
  { value: 5, label: "V" },
  { value: 6, label: "S" },
  { value: 7, label: "D" },
];

/** Formulario para crear una nueva planificación de medicación */
export default function NewSchedule() {
  const { id, patientId } = useLocalSearchParams<{
    id: string;
    patientId?: string;
  }>();

  const router = useRouter();

  const [uid, setUid] = useState<string | null>(null);

  const [pattern, setPattern] = useState<SchedulePattern>("DAILY");
  const [times, setTimes] = useState<string>("");
  const [selectedDow, setSelectedDow] = useState<number[]>([]);
  const [every, setEvery] = useState<string>("");
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
  });
  const [endDate, setEndDate] = useState<string>("");
  const [tol, setTol] = useState<string>("");

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

  /** Alterna un día en la selección de DOW */
  function toggleDow(day: number) {
    setSelectedDow((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  }

  async function save() {
    if (!uid || !id) return;

    const start = parseDate(startDate);
    const end = endDate.trim() ? parseDate(endDate) : null;

    if (!start) {
      Alert.alert("Fecha inicio inválida", "Selecciona una fecha de inicio");
      return;
    }
    if (endDate.trim() && !end) {
      Alert.alert("Fecha fin inválida", "Selecciona una fecha de fin válida");
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
        Alert.alert("Faltan horas", "Indica al menos una hora (ej. 08:00)");
        return;
      }
      const invalid = t.find((x) => !isValidTime(x));
      if (invalid) {
        Alert.alert("Hora inválida", `Formato incorrecto: ${invalid}`);
        return;
      }
      base.times = t;
    }

    if (pattern === "DOW") {
      if (!selectedDow.length) {
        Alert.alert("Faltan días", "Selecciona al menos un día de la semana");
        return;
      }
      base.dow = selectedDow;
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
    <SafeAreaView style={[styles.container, { backgroundColor: Colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.screenTitle}>Nueva planificación</Text>

        {/* Selector de patrón */}
        <Text style={styles.label}>Tipo de frecuencia</Text>
        <View style={styles.patternGrid}>
          {PATTERN_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => setPattern(opt.value)}
              style={[
                styles.patternCard,
                pattern === opt.value && styles.patternCardSelected,
              ]}
            >
              <Text
                style={[
                  styles.patternTitle,
                  pattern === opt.value && styles.patternTitleSelected,
                ]}
              >
                {opt.label}
              </Text>
              <Text
                style={[
                  styles.patternDesc,
                  pattern === opt.value && styles.patternDescSelected,
                ]}
              >
                {opt.desc}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Horas (para DAILY y DOW) */}
        {(pattern === "DAILY" || pattern === "DOW") && (
          <Card>
            <Text style={styles.label}>Horas de la toma</Text>
            <Text style={styles.help}>
              Separa varias horas con coma (ej. 08:00, 14:00, 20:00)
            </Text>
            <TextInput
              value={times}
              onChangeText={setTimes}
              placeholder="08:00, 20:00"
              placeholderTextColor={Colors.muted}
              style={styles.input}
            />
          </Card>
        )}

        {/* Selector de días (para DOW) */}
        {pattern === "DOW" && (
          <Card>
            <Text style={styles.label}>Días de la semana</Text>
            <View style={styles.dowRow}>
              {DOW_LABELS.map((day) => {
                const isActive = selectedDow.includes(day.value);
                return (
                  <Pressable
                    key={day.value}
                    onPress={() => toggleDow(day.value)}
                    style={[
                      styles.dowBtn,
                      isActive && styles.dowBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dowBtnText,
                        isActive && styles.dowBtnTextActive,
                      ]}
                    >
                      {day.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        )}

        {/* Intervalo (para EVERY_X_HOURS) */}
        {pattern === "EVERY_X_HOURS" && (
          <Card>
            <Text style={styles.label}>Intervalo en horas</Text>
            <Text style={styles.help}>Cada cuántas horas se debe tomar</Text>
            <TextInput
              value={every}
              onChangeText={setEvery}
              keyboardType="numeric"
              placeholder="8"
              placeholderTextColor={Colors.muted}
              style={styles.input}
            />
          </Card>
        )}

        {/* Fechas */}
        <Card>
          <Text style={styles.label}>Fecha de inicio</Text>
          <DatePickerField
            value={startDate}
            onChange={setStartDate}
            placeholder="Seleccionar fecha de inicio"
          />

          <Text style={[styles.label, { marginTop: 12 }]}>
            Fecha de fin (opcional)
          </Text>
          <DatePickerField
            value={endDate}
            onChange={setEndDate}
            placeholder="Sin fecha de fin"
            clearable
          />

          <Text style={[styles.label, { marginTop: 12 }]}>
            Tolerancia (minutos)
          </Text>
          <Text style={styles.help}>
            Margen de tiempo antes y después de la hora programada
          </Text>
          <TextInput
            value={tol}
            onChangeText={setTol}
            keyboardType="numeric"
            placeholder="30"
            placeholderTextColor={Colors.muted}
            style={styles.input}
          />
        </Card>

        <PrimaryButton title="Guardar planificación" onPress={save} />
        <PrimaryButton
          title="Cancelar"
          variant="danger"
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.text,
  },
  label: {
    fontWeight: "600",
    color: Colors.text,
    marginBottom: 4,
  },
  help: {
    color: Colors.muted,
    fontSize: 13,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 12,
    color: Colors.text,
    backgroundColor: Colors.card,
  },
  patternGrid: {
    gap: 8,
  },
  patternCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    padding: 14,
    borderRadius: 12,
  },
  patternCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: "#DBEAFE",
  },
  patternTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text,
  },
  patternTitleSelected: {
    color: Colors.primary,
  },
  patternDesc: {
    color: Colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
  patternDescSelected: {
    color: Colors.primary,
  },
  dowRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
    marginTop: 4,
  },
  dowBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.card,
  },
  dowBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  dowBtnText: {
    fontWeight: "700",
    color: Colors.text,
    fontSize: 14,
  },
  dowBtnTextActive: {
    color: "#FFFFFF",
  },
});
