import { useCallback, useEffect, useState } from "react";
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

  const [pattern, setPattern] = useState<SchedulePattern>("DAILY");
  const [times, setTimes] = useState("");
  const [selectedDow, setSelectedDow] = useState<number[]>([]);
  const [every, setEvery] = useState("8");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [tol, setTol] = useState("30");
  const [locked, setLocked] = useState(false);
  const [ownerPatientId, setOwnerPatientId] = useState<string | undefined>(patientId);

  const disabled = locked || isReadOnly;

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
        if (s.dow?.length) setSelectedDow(s.dow);
        else setSelectedDow([]);
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

  /** Alterna un día en la selección de DOW */
  function toggleDow(day: number) {
    if (disabled) return;
    setSelectedDow((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  }

  async function save() {
    if (locked) {
      Alert.alert("No editable", "La planificación ya ha finalizado");
      return;
    }
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
        Alert.alert("Faltan horas", "Indica al menos una hora (ej. 08:00)");
        return;
      }
      const invalid = t.find((x) => !isValidTime(x));
      if (invalid) {
        Alert.alert("Hora inválida", `Formato incorrecto: ${invalid}`);
        return;
      }
      patch.times = t;
    }

    if (pattern === "DOW") {
      if (!selectedDow.length) {
        Alert.alert("Faltan días", "Selecciona al menos un día de la semana");
        return;
      }
      patch.dow = selectedDow;
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
    <SafeAreaView style={[styles.container, { backgroundColor: Colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.screenTitle}>
          {isReadOnly ? "Ver planificación" : "Editar planificación"}
        </Text>

        {locked && (
          <Card>
            <Text style={styles.lockedText}>
              ⚠️ Esta planificación ya ha finalizado y no se puede modificar.
            </Text>
          </Card>
        )}

        {/* Selector de patrón */}
        <Text style={styles.label}>Tipo de frecuencia</Text>
        <View style={styles.patternGrid}>
          {PATTERN_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => !disabled && setPattern(opt.value)}
              style={[
                styles.patternCard,
                pattern === opt.value && styles.patternCardSelected,
                disabled && styles.disabledCard,
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

        {/* Horas */}
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
              editable={!disabled}
            />
          </Card>
        )}

        {/* Selector de días (DOW) */}
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
                      disabled && styles.disabledCard,
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

        {/* Intervalo (EVERY_X_HOURS) */}
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
              editable={!disabled}
            />
          </Card>
        )}

        <Card>
          <Text style={styles.label}>Fecha de inicio</Text>
          <DatePickerField
            value={startDate}
            onChange={setStartDate}
            placeholder="Seleccionar fecha de inicio"
            disabled={disabled}
          />

          <Text style={[styles.label, { marginTop: 12 }]}>
            Fecha de fin (opcional)
          </Text>
          <DatePickerField
            value={endDate}
            onChange={setEndDate}
            placeholder="Sin fecha de fin"
            disabled={disabled}
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
            editable={!disabled}
          />
        </Card>

        {!disabled && (
          <>
            <PrimaryButton title="Guardar cambios" onPress={save} />
            <PrimaryButton title="Eliminar planificación" variant="danger" onPress={handleDelete} />
          </>
        )}
        <PrimaryButton
          title="Volver"
          variant={disabled ? "primary" : "danger"}
          onPress={() => goToMed()}
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
  lockedText: {
    color: Colors.danger,
    fontWeight: "600",
  },
  disabledCard: {
    opacity: 0.6,
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
