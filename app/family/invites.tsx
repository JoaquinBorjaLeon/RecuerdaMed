import { useEffect, useState } from "react";
import { View, Text, FlatList, Alert } from "react-native";
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
    <View style={{ flex: 1, padding: 16, backgroundColor: Colors.background }}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: Colors.text }}>
        Invitaciones
      </Text>

      <FlatList
        data={invites}
        keyExtractor={(i) => i.id}
        ListEmptyComponent={
          <Text style={{ color: Colors.muted, marginTop: 20 }}>
            No tienes invitaciones pendientes.
          </Text>
        }
        renderItem={({ item }) => (
          <Card>
            <Text style={{ fontWeight: "700", color: Colors.text }}>
              Invitación de
            </Text>

            <Text style={{ marginTop: 4, color: Colors.text }}>
              {item.patient?.fullName ?? "Paciente"}
            </Text>

            {item.patient?.email && (
              <Text style={{ color: Colors.muted }}>{item.patient.email}</Text>
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
    </View>
  );
}
