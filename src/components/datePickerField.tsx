import { useState } from "react";
import { View, Text, Pressable, Platform, StyleSheet } from "react-native";
import { Colors } from "../theme/colors";

type Props = {
  value: string;           // "YYYY-MM-DD" o ""
  onChange: (ymd: string) => void;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;     // Muestra botón para borrar la fecha seleccionada
};

/**
 * Selector de fecha interactivo.
 * - En web: usa <input type="date"> nativo del navegador.
 * - En nativo: muestra un botón que abre el DateTimePicker del sistema.
 */
export function DatePickerField({
  value,
  onChange,
  placeholder = "Seleccionar fecha",
  disabled = false,
  clearable = false,
}: Props) {
  const [showPicker, setShowPicker] = useState(false);

  /** Convierte "YYYY-MM-DD" a un Date local */
  function ymdToDate(ymd: string): Date {
    if (!ymd) return new Date();
    const [y, m, d] = ymd.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  /** Convierte un Date a "YYYY-MM-DD" */
  function dateToYmd(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  /** Formatea "YYYY-MM-DD" para mostrar al usuario como "DD/MM/YYYY" */
  function formatDisplay(ymd: string): string {
    if (!ymd) return "";
    const [y, m, d] = ymd.split("-");
    return `${d}/${m}/${y}`;
  }

  /** Botón para borrar la fecha seleccionada */
  function renderClearButton() {
    if (!clearable || !value || disabled) return null;
    return (
      <Pressable
        onPress={() => onChange("")}
        style={styles.clearButton}
        hitSlop={8}
      >
        <Text style={styles.clearButtonText}>✕</Text>
      </Pressable>
    );
  }

  // En web usamos <input type="date"> que da un calendario nativo
  if (Platform.OS === "web") {
    return (
      <View style={styles.webRow}>
        <View style={styles.webInputWrap}>
          <input
            type="date"
            value={value || ""}
            onChange={(e: any) => onChange(e.target.value)}
            disabled={disabled}
            style={{
              border: `1px solid ${Colors.border}`,
              borderRadius: 10,
              padding: 12,
              color: value ? Colors.text : Colors.muted,
              backgroundColor: Colors.card,
              fontSize: 15,
              fontFamily: "inherit",
              width: "100%",
              boxSizing: "border-box" as any,
              opacity: disabled ? 0.6 : 1,
              WebkitAppearance: "none" as any,
              appearance: "none" as any,
            }}
          />
        </View>
        {clearable && !!value && !disabled && (
          <Pressable
            onPress={() => onChange("")}
            style={styles.webClearButton}
          >
            <Text style={styles.webClearText}>Borrar</Text>
          </Pressable>
        )}
      </View>
    );
  }

  // En nativo: botón + DateTimePicker
  const DateTimePicker = require("@react-native-community/datetimepicker").default;

  return (
    <View style={styles.container}>
      <View style={styles.nativeRow}>
        <Pressable
          onPress={() => !disabled && setShowPicker(true)}
          style={[styles.button, disabled && styles.buttonDisabled, { flex: 1 }]}
        >
          <Text style={[styles.buttonText, !value && styles.placeholderText]}>
            {value ? formatDisplay(value) : placeholder}
          </Text>
          <Text style={styles.calendarIcon}>📅</Text>
        </Pressable>

        {renderClearButton()}
      </View>

      {showPicker && (
        <DateTimePicker
          value={ymdToDate(value)}
          mode="date"
          display="default"
          locale="es-ES"
          onChange={(_event: any, selectedDate?: Date) => {
            setShowPicker(false);
            if (selectedDate) {
              onChange(dateToYmd(selectedDate));
            }
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  // — Nativo —
  nativeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 12,
    backgroundColor: Colors.card,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: Colors.text,
    fontSize: 15,
  },
  placeholderText: {
    color: Colors.muted,
  },
  calendarIcon: {
    fontSize: 18,
  },
  clearButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  clearButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  // — Web —
  webRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: "100%",
  },
  webInputWrap: {
    flex: 1,
  },
  webClearButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#FEE2E2",
  },
  webClearText: {
    color: Colors.danger,
    fontWeight: "600",
    fontSize: 14,
  },
});
