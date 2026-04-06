import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { Colors } from "../theme/colors";

type Props = {
  title: string;
  onPress: () => void;
  variant?: "primary" | "danger";
  disabled?: boolean;
};

/** Botón principal con variante "primary" (azul) o "danger" (rojo) */
export function PrimaryButton({ title, onPress, variant = "primary", disabled = false }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={disabled ? 0.6 : 0.85}
      style={[
        styles.button,
        {
          backgroundColor: disabled
            ? Colors.muted
            : variant === "danger"
            ? Colors.danger
            : Colors.primary,
        },
      ]}
    >
      <Text style={[styles.text, disabled && { opacity: 0.6 }]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 8,
  },
  text: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
});
