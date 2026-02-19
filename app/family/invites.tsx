import { useEffect, useState } from "react";
import { View, Text, FlatList, Alert, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import type { Href } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "../../src/lib/firebase";
import {
  getPendingInvitesByEmail,
  acceptInvite,
  rejectInvite,
} from "../../src/api/careLinks";
import { getUserById, UserProfile } from "../../src/api/users";

import { Card } from "../../src/components/card";
import { PrimaryButton } from "../../src/components/primaryButton";
import { Colors } from "../../src/theme/colors";

type InviteWithPatient = {
  id: string;
  patient: UserProfile | null;
};

export default function FamilyInvitesScreen() {
  const router = useRouter();
  const [invites, setInvites] = useState<InviteWithPatient[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u || !u.email) {
        router.replace("/");
        return;
      }

      const raw = await getPendingInvitesByEmail(u.email);
      const enriched = await Promise.all(
        raw.map(async (i) => ({
          id: i.id,
          patient: await getUserById(i.patientId),
        }))
      );
      setInvites(enriched);
    });

    return unsub;
  }, [router]);

  async function handleAccept(id: string) {
    const user = auth.currentUser;
    if (!user) return;

    try {
      await acceptInvite(id, user.uid);
      Alert.alert("OK", "Invitación aceptada");
      setInvites((prev) => prev.filter((i) => i.id !== id));
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo aceptar");
    }
  }

  async function handleReject(id: string) {
    try {
      await rejectInvite(id);
      Alert.alert("OK", "Invitación rechazada");
      setInvites((prev) => prev.filter((i) => i.id !== id));
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo rechazar");
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors.background }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Invitaciones</Text>
        <Text style={styles.subtitle}>
          Acepta o rechaza invitaciones de pacientes.
        </Text>
      </View>

      <FlatList
        data={invites}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No tienes invitaciones pendientes.
          </Text>
        }
        renderItem={({ item }) => (
          <Card>
            <Text style={styles.cardTitle}>
              Invitación de
            </Text>

            <Text style={styles.cardText}>
              {item.patient?.fullName ?? "Paciente"}
            </Text>

            {item.patient?.email && (
              <Text style={styles.cardMuted}>{item.patient.email}</Text>
            )}

            <PrimaryButton
              title="Aceptar invitación"
              onPress={() => handleAccept(item.id)}
            />
            <PrimaryButton
              title="Rechazar"
              variant="danger"
              onPress={() => handleReject(item.id)}
            />
          </Card>
        )}
      />

      <PrimaryButton
        title="Volver al inicio"
        onPress={() => router.replace("/home" as Href)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: Colors.text,
  },
  subtitle: {
    marginTop: 6,
    color: Colors.muted,
  },
  listContent: {
    paddingBottom: 24,
  },
  emptyText: {
    color: Colors.muted,
    marginTop: 12,
  },
  cardTitle: {
    fontWeight: "700",
    color: Colors.text,
  },
  cardText: {
    marginTop: 4,
    color: Colors.text,
  },
  cardMuted: {
    color: Colors.muted,
  },
});
