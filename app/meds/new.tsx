import { useState, useEffect } from "react";
import { View, Text, TextInput, Button, Alert, useColorScheme } from "react-native";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../src/lib/firebase";
import { createMedication } from "../src/api/meds";

export default function NewMedication() {
  const router = useRouter();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  const [uid, setUid] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [form, setForm] = useState("");
  const [strength, setStrength] = useState("");
  const [notes, setNotes] = useState("");

  const inputStyle = {
    borderWidth: 1,
    borderColor: isDark ? "#E5E7EB" : "#111827",
    borderRadius: 10,
    padding: 12,
    backgroundColor: isDark ? "#111827" : "#FFFFFF",
    color: isDark ? "#F9FAFB" : "#111827",
  } as const;

  const placeholderColor = isDark ? "#9CA3AF" : "#6B7280";
  const labelColor = isDark ? "#F9FAFB" : "#111827";
  const bgColor = isDark ? "#0B1220" : "#FFFFFF";

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) router.replace("/");
      else setUid(u.uid);
    });
    return unsub;
  }, [router]);

  async function save() {
    if (!uid) return;
    if (!name.trim()) return Alert.alert("Falta nombre", "Indica el nombre de la medicación.");
    try {
      await createMedication(uid, {
        name: name.trim(),
        form: form.trim(),
        strength: strength.trim(),
        notes: notes.trim(),
      });
      Alert.alert("Listo", "Medicación guardada");
      router.back();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo guardar");
    }
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 12, backgroundColor: bgColor }}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: labelColor }}>
        Nueva medicación
      </Text>

      <Text style={{ fontWeight: "600", color: labelColor }}>Nombre *</Text>
      <TextInput
        placeholder="Ej: Paracetamol"
        placeholderTextColor={placeholderColor}
        value={name}
        onChangeText={setName}
        autoCapitalize="sentences"
        style={inputStyle}
      />

      <Text style={{ fontWeight: "600", color: labelColor }}>Forma</Text>
      <TextInput
        placeholder="Ej: Comprimido, jarabe…"
        placeholderTextColor={placeholderColor}
        value={form}
        onChangeText={setForm}
        autoCapitalize="sentences"
        style={inputStyle}
      />

      <Text style={{ fontWeight: "600", color: labelColor }}>Dosis</Text>
      <TextInput
        placeholder="Ej: 500 mg"
        placeholderTextColor={placeholderColor}
        value={strength}
        onChangeText={setStrength}
        style={inputStyle}
      />

      <Text style={{ fontWeight: "600", color: labelColor }}>Notas</Text>
      <TextInput
        placeholder="Ej: Tomar con comida"
        placeholderTextColor={placeholderColor}
        value={notes}
        onChangeText={setNotes}
        multiline
        style={{ ...inputStyle, minHeight: 90, textAlignVertical: "top" as const }}
      />

      <Button title="Guardar" onPress={save} />
      <Button title="Cancelar" onPress={() => router.back()} />
    </View>
  );
}
