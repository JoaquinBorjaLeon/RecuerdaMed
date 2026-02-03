import { useEffect, useState } from "react";
import { View, Text, FlatList, Alert, Platform, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "../../../src/lib/firebase";
import {
  getActiveCareLinksForPatient,
  removeCareLink,
} from "../../../src/api/careLinks";
import type { UserProfile } from "../../../src/api/users";

import { Card } from "../../../src/components/card";
import { PrimaryButton } from "../../../src/components/primaryButton";
import { Colors } from "../../../src/theme/colors";

type FamilyItem = {
  linkId: string;
  caregiver: UserProfile;
};

export default function ManageFamilies() {
  const router = useRouter();
  const [items, setItems] = useState<FamilyItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.replace("/");
        return;
      }

      try {
        const data = await getActiveCareLinksForPatient(u.uid);
        const onlyFamily = data.filter((i) => i.caregiver.role === "FAMILY");
        setItems(onlyFamily as FamilyItem[]);
      } catch (e) {
        console.warn(e);
      } finally {
        setLoading(false);
      }
    });

    return unsub;
  }, [router]);

  async function handleRemove(linkId: string, name: string) {
    const confirmed =
      Platform.OS === "web"
        ? window.confirm(`¿Eliminar a ${name}?`)
        : await new Promise<boolean>((resolve) => {
            Alert.alert("Eliminar familiar", `¿Eliminar a ${name}?`, [
              { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
              { text: "Eliminar", style: "destructive", onPress: () => resolve(true) },
            ]);
          });

    if (!confirmed) return;

    try {
      await removeCareLink(linkId);
      setItems((prev) => prev.filter((i) => i.linkId !== linkId));
    } catch (e: any) {
      const msg = e?.message ?? "No se pudo eliminar";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert("Error", msg);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <Text style={styles.title}>Gestionar familiares</Text>

      <FlatList
        data={items}
        keyExtractor={(i) => i.linkId}
        ListEmptyComponent={
          !loading ? (
            <Text style={{ color: Colors.muted, marginTop: 20 }}>
              No tienes familiares asignados.
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Card>
            <Text style={styles.name}>{item.caregiver.fullName ?? "Familiar"}</Text>

            {item.caregiver.email && (
              <Text style={styles.email}>{item.caregiver.email}</Text>
            )}

            <PrimaryButton
              title="Eliminar familiar"
              variant="danger"
              onPress={() =>
                handleRemove(item.linkId, item.caregiver.fullName ?? "este familiar")
              }
            />
          </Card>
        )}
      />

      <PrimaryButton title="Volver" onPress={() => router.back()} />
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
  },
});
