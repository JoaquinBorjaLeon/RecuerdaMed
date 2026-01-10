import { Appearance } from "react-native";

const scheme = Appearance.getColorScheme();

export const Colors = {
  background: scheme === "dark" ? "#000000" : "#FFFFFF",
  card: scheme === "dark" ? "#111827" : "#F9FAFB",
  text: scheme === "dark" ? "#F9FAFB" : "#111827",
  muted: scheme === "dark" ? "#9CA3AF" : "#6B7280",
  border: scheme === "dark" ? "#374151" : "#D1D5DB",
  primary: "#2563EB",
  danger: "#DC2626",
};
