// app/home.tsx
import { useEffect, useRef, useState } from "react";
import { View, Text, FlatList, StyleSheet, Platform } from "react-native";
import { useRouter } from "expo-router";

import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "../src/lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
} from "firebase/firestore";

import type { Medication } from "../src/types";
import type { UserProfile } from "../src/api/users";
import { getUserById } from "../src/api/users";

import { registerForPushNotifications } from "../src/api/notifications";
import { savePushToken } from "../src/api/pushTokens";

import { Card } from "../src/components/card";
import { PrimaryButton } from "../src/components/primaryButton";
import { Colors } from "../src/theme/colors";

export default function Home() {
  const router = useRouter();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [meds, setMeds] = useState<Medication[]>([]);
  const [notificationsReady, setNotificationsReady] = useState(false);

  const unsubMedsRef = useRef<null | (() => void)>(null);
  const unsubAuthRef = useRef<null | (() => void)>(null);

  useEffect(() => {
    unsubAuthRef.current = onAuthStateChanged(auth, async (u) => {
      if (unsubMedsRef.current) {
        unsubMedsRef.current();
        unsubMedsRef.current = null;
      }

      if (!u) {
        setUser(null);
        setMeds([]);
        router.replace("/");
        return;
      }

      // 🔐 Perfil
      const profile = await getUserById(u.uid);
      if (!profile) return;

      setUser(profile);

      // 🔔 Push notifications (solo nativo)
      if (!notificationsReady && Platform.OS !== "web") {
        try {
          const token = await registerForPushNotifications();
          await savePushToken(u.uid, token);
          setNotificationsReady(true);
        } catch {
          console.warn("Notificaciones no habilitadas");
        }
      }

      // 👤 SOLO paciente escucha sus medicaciones
      if (profile.role === "PATIENT") {
        const q = query(
          collection(db, "medications"),
          where("patientId", "==", u.uid),
          orderBy("createdAt", "desc")
        );

        unsubMedsRef.current = onSnapshot(q, (snap) => {
          const items = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          })) as Medication[];
          setMeds(items);
        });
      }
    });

    return () => {
      if (unsubMedsRef.current) unsubMedsRef.current();
      if (unsubAuthRef.current) unsubAuthRef.current();
    };
  }, [router, notificationsReady]);

  async function handleLogout() {
    await signOut(auth);
    router.replace("/");
  }

  if (!user) return null;

  /* =========================
     🧑‍⚕️ HOME CUIDADOR
     ========================= */
  if (user.role === "CAREGIVER") {
    return (
      <View style={[styles.container, { backgroundColor: Colors.background }]}>
        <Text style={styles.title}>Panel del cuidador</Text>

        <PrimaryButton
          title="Mis pacientes"
          onPress={() => router.push("/care/patients")}
        />

        <PrimaryButton
          title="Mis invitaciones"
          onPress={() => router.push("/care/invites")}
        />

        <PrimaryButton
          title="Cerrar sesión"
          variant="danger"
          onPress={handleLogout}
        />
      </View>
    );
  }

  /* =========================
     👤 HOME PACIENTE
     ========================= */
  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <Text style={styles.title}>Mis medicaciones</Text>

      <FlatList
        data={meds}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={{ color: Colors.muted }}>
            No tienes medicaciones aún.
          </Text>
        }
        renderItem={({ item }) => (
          <Card
            onPress={() =>
              router.push({ pathname: "/meds/[id]", params: { id: item.id } })
            }
          >
            <Text style={styles.cardTitle}>{item.name}</Text>
            {!!item.strength && (
              <Text style={styles.cardText}>{item.strength}</Text>
            )}
            {!!item.form && (
              <Text style={styles.cardText}>{item.form}</Text>
            )}
          </Card>
        )}
      />

      <PrimaryButton
        title="Añadir medicación"
        onPress={() => router.push("/meds/new")}
      />

      <PrimaryButton
        title="Ver tomas"
        onPress={() => router.push("/tomas")}
      />

      <PrimaryButton
        title="Invitar cuidador"
        onPress={() => router.push("/care/invite")}
      />

      {/* ✅ NUEVO: solo paciente */}
      <PrimaryButton
        title="Gestionar cuidadores"
        onPress={() => router.push("/care/patient/caregivers")}
      />

      <PrimaryButton
        title="Cerrar sesión"
        variant="danger"
        onPress={handleLogout}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
  },
  cardText: {
    color: Colors.muted,
    marginTop: 2,
  },
});
