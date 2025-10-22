// app/home.tsx
import { View, Text, Button, Alert } from "react-native";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { auth, db } from "./src/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

export default function Home() {
  const router = useRouter();

  async function crearPacienteDemo() {
    try {
      await addDoc(collection(db, "patients"), {
        fullName: "Juan Pérez",
        timezone: "Europe/Madrid",
        locale: "es-ES",
        createdAt: serverTimestamp(),
      });
      Alert.alert("OK", "Paciente demo creado");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo crear el paciente");
    }
  }

  async function logout() {
    await signOut(auth);
    router.replace("/"); // vuelve a login
  }

  return (
    <View style={{ flex:1, justifyContent:"center", padding:24, gap:12 }}>
      <Text style={{ fontSize:22 }}>Próxima toma</Text>
      <Text style={{ fontSize:16, marginBottom:12 }}>Paracetamol 500 mg — 10:00</Text>
      <Button title="Tomada" onPress={() => {}} />
      <View style={{ height:8 }} />
      <Button title="Posponer 10 min" onPress={() => {}} />
      <View style={{ height:16 }} />
      <Button title="Crear paciente demo" onPress={crearPacienteDemo} />
      <Button title="Cerrar sesión" onPress={logout} />
    </View>
  );
}
