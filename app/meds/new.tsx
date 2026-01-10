import { useState, useEffect } from "react";
import { View, Text, TextInput, Alert, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "../src/lib/firebase";
import { createMedication } from "../src/api/meds";
import { Colors } from "../src/theme/colors";
import { PrimaryButton } from "../src/components/primaryButton";

export default function NewMedication() {
  const router = useRouter();
  const { patientId } = useLocalSearchParams<{ patientId?: string }>();

  const [uid, setUid] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [form, setForm] = useState("");
  const [strength, setStrength] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.replace("/");
        return;
      }
      setUid(u.uid);
    });
  }, [router]);

  async function save() {
    // 🔴 validaciones importantes
    if (!uid) return;
    if (!patientId) {
      Alert.alert("Error", "Paciente no identificado");
      return;
    }
    if (!name.trim()) {
      Alert.alert("Falta nombre", "Indica el nombre de la medicación.");
      return;
    }

    try {
      // 🔑 CLAVE: usamos patientId, NO uid del cuidador
      await createMedication(patientId, {
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
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <Text style={styles.title}>Nueva medicación</Text>

      <Text style={styles.label}>Nombre *</Text>
      <TextInput
        style={styles.input}
        placeholder="Paracetamol"
        placeholderTextColor={Colors.muted}
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Forma</Text>
      <TextInput
        style={styles.input}
        placeholder="Comprimido, jarabe…"
        placeholderTextColor={Colors.muted}
        value={form}
        onChangeText={setForm}
      />

      <Text style={styles.label}>Dosis</Text>
      <TextInput
        style={styles.input}
        placeholder="500 mg"
        placeholderTextColor={Colors.muted}
        value={strength}
        onChangeText={setStrength}
      />

      <Text style={styles.label}>Notas</Text>
      <TextInput
        style={[styles.input, { minHeight: 90 }]}
        multiline
        placeholder="Tomar con comida"
        placeholderTextColor={Colors.muted}
        value={notes}
        onChangeText={setNotes}
      />

      <PrimaryButton title="Guardar" onPress={save} />
      <PrimaryButton title="Cancelar" variant="danger" onPress={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: "700", color: Colors.text, marginBottom: 12 },
  label: { color: Colors.text, fontWeight: "600", marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 12,
    color: Colors.text,
    marginTop: 4,
  },
});
