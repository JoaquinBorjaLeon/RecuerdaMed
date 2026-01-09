// app/tomas.tsx
import { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./src/lib/firebase";

import type { Toma } from "./src/types";
import { listenUpcomingTomas, confirmToma } from "./src/api/tomas";

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("es-ES", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
}

export default function TomasScreen() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [tomas, setTomas] = useState<Toma[]>([]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.replace("/");
        return;
      }
      setUid(u.uid);

      const unsubTomas = listenUpcomingTomas(u.uid, (items) => {
        // aquí puedes filtrar si quieres solo próximas
        setTomas(items);
      });

      return () => unsubTomas();
    });

    return () => unsubAuth();
  }, [router]);

  async function handleConfirm(tomaId: string) {
    try {
      await confirmToma(tomaId);
      // No hace falta setState manual: el onSnapshot refresca
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo confirmar la toma");
    }
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Mis tomas</Text>

      <FlatList
        data={tomas}
        keyExtractor={(t) => t.id}
        ListEmptyComponent={<Text>No hay tomas.</Text>}
        renderItem={({ item }) => {
          const canConfirm = item.status === "DUE" || item.status === "PLANNED"; // si quieres SOLO DUE: item.status === "DUE"
          return (
            <View style={{ padding: 12, borderWidth: 1, borderRadius: 10, marginBottom: 10 }}>
              <Text style={{ fontWeight: "700" }}>
                {item.status} • {fmt(item.plannedAt)}
              </Text>
              <Text style={{ marginTop: 6 }}>
                Ventana: {fmt(item.windowStart)} — {fmt(item.windowEnd)}
              </Text>

              <TouchableOpacity
                disabled={!canConfirm}
                onPress={() => handleConfirm(item.id)}
                style={{
                  marginTop: 10,
                  padding: 12,
                  borderRadius: 10,
                  alignItems: "center",
                  opacity: canConfirm ? 1 : 0.4,
                  backgroundColor: "#16a34a",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "800" }}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </View>
  );
}
