import { useEffect, useState } from "react";
import { View, Text, FlatList, Alert, Platform, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "@/lib/firebase";
import {
  getActiveCareLinksForPatient,
  removeCareLink,
} from "@/api/careLinks";
import type { UserProfile } from "@/api/users";

import { Card } from "@/components/card";
import { PrimaryButton } from "@/components/primaryButton";
import { Colors } from "@/theme/colors";

type CaregiverItem = {
  linkId: string;
  caregiver: UserProfile;
};

export default function ManageCaregivers() {
  const router = useRouter();
  const [items, setItems] = useState<CaregiverItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.replace("/");
        return;
      }

      try {
        const data = await getActiveCareLinksForPatient(u.uid);
        setItems(data);
      } catch (e) {
        console.warn(e);
      } finally {
        setLoading(false);
      }
    });

    return unsub;
  }, [router]);

  async function handleRemove(linkId: string, name: string) {
    try {
      await removeCareLink(linkId);
      setItems((prev) => prev.filter((item) => item.linkId !== linkId));
    } catch (e: any) {
      if (Platform.OS === "web") {
        window.alert(e?.message ?? "No se pudo eliminar el cuidador");
      } else {
        Alert.alert(
          "Error",
          e?.message ?? "No se pudo eliminar el cuidador"
        );
      }
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <Text style={styles.title}>Gestionar cuidadores</Text>

      <FlatList
        data={items}
        keyExtractor={(i) => i.linkId}
        ListEmptyComponent={
          !loading ? (
            <Text style={{ color: Colors.muted, marginTop: 20 }}>
              No tienes cuidadores asignados.
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Card>
            <Text style={styles.name}>
              {item.caregiver.fullName ?? "Cuidador"}
            </Text>

            {item.caregiver.email && (
              <Text style={styles.email}>{item.caregiver.email}</Text>
            )}

            <PrimaryButton
              title="Eliminar cuidador"
              variant="danger"
              onPress={() =>
                handleRemove(
                  item.linkId,
                  item.caregiver.fullName ?? "este cuidador"
                )
              }
            />
          </Card>
        )}
      />

      <PrimaryButton
        title="Volver"
        onPress={() => router.replace("/home")}
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
  name: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
  },
  email: {
    color: Colors.muted,
    marginBottom: 8,
  },
});
