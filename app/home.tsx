// app/home.tsx
import { useEffect, useRef, useState } from "react";
import { View, Text, Button, Alert, FlatList, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

import { onAuthStateChanged, signOut } from "firebase/auth";
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
  const [meds, setMeds] = useState<Medication[]>([]);

  // refs para almacenar los unsubscribe y poder cortarlos donde queramos
  const unsubMedsRef = useRef<null | (() => void)>(null);
  const unsubAuthRef = useRef<null | (() => void)>(null);

  // ✅ Suscripción en tiempo real a las medicaciones del usuario
  useEffect(() => {
    unsubAuthRef.current = onAuthStateChanged(auth, (u) => {
      // Si cambia el user, corta el listener anterior de meds
      if (unsubMedsRef.current) {
        unsubMedsRef.current();
        unsubMedsRef.current = null;
      }

      if (!u) {
        setMeds([]);
        router.replace("/");
        return;
      }

      const q = query(
        collection(db, "medications"),
        where("patientId", "==", u.uid),
        orderBy("createdAt", "desc")
      );

      unsubMedsRef.current = onSnapshot(
        q,
        (snap) => {
          const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Medication[];
          setMeds(items);
        },
        // Evita que el app crashee cuando Auth pasa a null durante logout
        (err) => {
          if (err?.code !== "permission-denied") {
            console.warn("onSnapshot(medications) error:", err);
          }
        }
      );
    });

    // Limpieza al desmontar la pantalla
    return () => {
      if (unsubMedsRef.current) unsubMedsRef.current();
      if (unsubAuthRef.current) unsubAuthRef.current();
    };
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

  // 🔒 Cerrar sesión sin errores de permisos
  async function handleLogout() {
    try {
      // Corta el snapshot antes de cerrar sesión
      if (unsubMedsRef.current) {
        unsubMedsRef.current();
        unsubMedsRef.current = null;
      }
      await signOut(auth);
      router.replace("/");
    } catch (e) {
      console.warn("logout error:", e);
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

      <Button title="Cerrar sesión" onPress={handleLogout} />
    </View>
  );
}
