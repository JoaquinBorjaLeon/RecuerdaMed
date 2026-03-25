import { useState, useEffect } from "react";
import { Text, TextInput, Alert, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "../../src/lib/firebase";
import { createMedication } from "../../src/api/meds";
import { Colors } from "../../src/theme/colors";
import { PrimaryButton } from "../../src/components/primaryButton";

export default function NewMedication() {
  const router = useRouter();
  const params = useLocalSearchParams<{ patientId?: string }>();

  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [form, setForm] = useState("");
  const [strength, setStrength] = useState("");
  const [notes, setNotes] = useState("");

  // 🔐 Auth
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.replace("/");
        return;
      }
      setUserId(u.uid);
    });
  }, [router]);

  async function save() {
    try {
      if (!userId) throw new Error("Usuario no autenticado");
      if (!name.trim()) throw new Error("El nombre es obligatorio");

      // ✅ CLAVE: si no viene patientId → es el propio paciente
      const realPatientId = params.patientId ?? userId;

      await createMedication(realPatientId, {
        name: name.trim(),
        form,
        strength,
        notes,
      });

      Alert.alert("OK", "Medicación creada");

      // 🔁 Redirección correcta
      if (params.patientId) {
        // cuidador
        router.replace({
          pathname: "/care/patient/[id]",
          params: { id: params.patientId },
        });
      } else {
        // paciente
        router.replace("/home");
      }
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "No se pudo guardar");
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors.background }]}>
      <Text style={styles.title}>Nueva medicación</Text>

      <Text style={styles.label}>Nombre *</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Paracetamol"
        placeholderTextColor={Colors.muted}
      />

      <Text style={styles.label}>Forma</Text>
      <TextInput
        style={styles.input}
        value={form}
        onChangeText={setForm}
        placeholder="Comprimido, jarabe…"
        placeholderTextColor={Colors.muted}
      />

      <Text style={styles.label}>Dosis</Text>
      <TextInput
        style={styles.input}
        value={strength}
        onChangeText={setStrength}
        placeholder="500 mg"
        placeholderTextColor={Colors.muted}
      />

      <Text style={styles.label}>Notas</Text>
      <TextInput
        style={[styles.input, { minHeight: 90 }]}
        multiline
        value={notes}
        onChangeText={setNotes}
        placeholder="Tomar con comida"
        placeholderTextColor={Colors.muted}
      />

      <PrimaryButton title="Guardar" onPress={save} />
      <PrimaryButton
        title="Cancelar"
        variant="danger"
        onPress={() =>
          params.patientId
            ? router.replace({
                pathname: "/care/patient/[id]",
                params: { id: params.patientId },
              })
            : router.replace("/home")
        }
      />
    </SafeAreaView>
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
