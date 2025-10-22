// app/home.tsx
import { useEffect, useState } from "react";
import { View, Text, Button, Alert, FlatList, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./src/lib/firebase";
import {
  addDoc,
  collection,
  serverTimestamp,
  onSnapshot,
  query,
  where,
  orderBy,
} from "firebase/firestore";

import type { Medication } from "./src/types";

export default function Home() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [meds, setMeds] = useState<Medication[]>([]);

  // ✅ Suscripción en tiempo real a las medicaciones del usuario
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.replace("/");
        return;
      }
      setUid(u.uid);

      const q = query(
        collection(db, "medications"),
        where("patientId", "==", u.uid),
        orderBy("createdAt", "desc")
      );
      const unsubMeds = onSnapshot(q, (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Medication[];
        setMeds(items);
      });

      return () => unsubMeds();
    });

    return () => unsubAuth();
  }, [router]);

  // (opcional) botón de prueba para crear un paciente demo
  async function crearPacienteDemo() {
    try {
      await addDoc(collection(db, "patients"), {
        fullName: "Juan Pérez",
        timezone: "Europe/Madrid",
        locale: "es-ES",
        createdAt: serverTimestamp(),
      });
      Alert.alert("OK", "Paciente demo creado en Firestore");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo crear el paciente");
    }
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, marginBottom: 8 }}>Mis medicaciones</Text>

      <FlatList
        data={meds}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text>No tienes medicaciones aún.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push({ pathname: "/meds/[id]", params: { id: item.id } })}
            style={{ padding: 12, borderWidth: 1, borderRadius: 8, marginBottom: 8 }}
          >
            <Text style={{ fontSize: 16, fontWeight: "600" }}>{item.name}</Text>
            {!!item.strength && <Text>{item.strength}</Text>}
            {!!item.form && <Text>{item.form}</Text>}
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity
        onPress={() => router.push({ pathname: "/meds/new" })}
        style={{ backgroundColor: "#2563eb", padding: 14, borderRadius: 10, alignItems: "center" }}
      >
        <Text style={{ color: "#fff", fontWeight: "700" }}>Añadir medicación</Text>
      </TouchableOpacity>

      {/* Botón de prueba opcional */}
      {/* <Button title="Crear paciente demo" onPress={crearPacienteDemo} /> */}

      <Button title="Cerrar sesión" onPress={() => signOut(auth)} />
    </View>
  );
}
