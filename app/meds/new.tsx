import { useState, useEffect } from "react";
import { View, Text, TextInput, Button, Alert } from "react-native";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../src/lib/firebase";
import { createMedication } from "../src/api/meds";

export default function NewMedication() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [form, setForm] = useState("");
  const [strength, setStrength] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) router.replace("/");
      else setUid(u.uid);
    });
    return unsub;
  }, []);

  async function save() {
    if (!uid) return;
    if (!name.trim()) return Alert.alert("Falta nombre", "Indica el nombre de la medicación.");
    try {
      await createMedication(uid, { name: name.trim(), form: form.trim(), strength: strength.trim(), notes: notes.trim() });
      Alert.alert("Listo", "Medicación guardada");
      router.back(); // vuelve a Home
    } catch (e:any) {
      Alert.alert("Error", e?.message ?? "No se pudo guardar");
    }
  }

  return (
    <View style={{ flex:1, padding:16, gap:10 }}>
      <Text style={{ fontSize:20, fontWeight:"700" }}>Nueva medicación</Text>
      <TextInput placeholder="Nombre (ej. Paracetamol)" value={name} onChangeText={setName}
        style={{ borderWidth:1, borderRadius:8, padding:12 }} />
      <TextInput placeholder="Forma (comprimido, jarabe…)" value={form} onChangeText={setForm}
        style={{ borderWidth:1, borderRadius:8, padding:12 }} />
      <TextInput placeholder="Dosis (ej. 500 mg)" value={strength} onChangeText={setStrength}
        style={{ borderWidth:1, borderRadius:8, padding:12 }} />
      <TextInput placeholder="Notas" value={notes} onChangeText={setNotes}
        style={{ borderWidth:1, borderRadius:8, padding:12 }} />

      <Button title="Guardar" onPress={save} />
      <Button title="Cancelar" onPress={() => router.back()} />
    </View>
  );
}
