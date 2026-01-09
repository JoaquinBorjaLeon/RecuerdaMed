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
import { registerForPushNotifications } from "./src/api/notifications";
import { savePushToken } from "./src/api/pushTokens";


export default function Home() {
  const router = useRouter();
  const [meds, setMeds] = useState<Medication[]>([]);
  const [notificationsReady, setNotificationsReady] = useState(false);

  // refs para unsubscribe
  const unsubMedsRef = useRef<null | (() => void)>(null);
  const unsubAuthRef = useRef<null | (() => void)>(null);

  useEffect(() => {
    unsubAuthRef.current = onAuthStateChanged(auth, async (u) => {
      // 🔥 cortar listener anterior
      if (unsubMedsRef.current) {
        unsubMedsRef.current();
        unsubMedsRef.current = null;
      }

      if (!u) {
        setMeds([]);
        setNotificationsReady(false);
        router.replace("/");
        return;
      }

      // 🔔 REGISTRO DE NOTIFICACIONES (H4.1)
      if (!notificationsReady) {
        try {
          const token = await registerForPushNotifications();
          await savePushToken(u.uid, token);
          console.log("Push token guardado");
          setNotificationsReady(true);
        } catch (e) {
          console.warn("Notificaciones no habilitadas:", e);
        }
      }

      // 📦 Listener de medicaciones
      const q = query(
        collection(db, "medications"),
        where("patientId", "==", u.uid),
        orderBy("createdAt", "desc")
      );

      unsubMedsRef.current = onSnapshot(
        q,
        (snap) => {
          const items = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          })) as Medication[];
          setMeds(items);
        },
        (err) => {
          if (err?.code !== "permission-denied") {
            console.warn("onSnapshot(medications) error:", err);
          }
        }
      );
    });

    return () => {
      if (unsubMedsRef.current) unsubMedsRef.current();
      if (unsubAuthRef.current) unsubAuthRef.current();
    };
  }, [router, notificationsReady]);

  // 🔒 Logout limpio
  async function handleLogout() {
    try {
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

      <TouchableOpacity
        onPress={() => router.push("/tomas")}
        style={{ backgroundColor: "#111827", padding: 14, borderRadius: 10, alignItems: "center" }}
      >
        <Text style={{ color: "#fff", fontWeight: "700" }}>Ver tomas</Text>
      </TouchableOpacity>


      <Button title="Cerrar sesión" onPress={handleLogout} />
    </View>
  );
}
