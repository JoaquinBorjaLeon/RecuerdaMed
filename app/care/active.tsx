import { useEffect, useState } from "react";
import { Text, FlatList, Alert, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "../../src/lib/firebase";
import {
  getActiveCareLinksForPatient,
  removeCareLink,
} from "../../src/api/careLinks";

import { Card } from "../../src/components/card";
import { PrimaryButton } from "../../src/components/primaryButton";
import { Colors } from "../../src/theme/colors";

export default function MyCaregivers() {
  const router = useRouter();
  const [items, setItems] = useState<
    { linkId: string; caregiver: any }[]
  >([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.replace("/");
        return;
      }
      const res = await getActiveCareLinksForPatient(u.uid);
      setItems(res);
    });
    return unsub;
  }, [router]);

  async function handleRemove(linkId: string) {
    try {
      await removeCareLink(linkId);
      setItems((prev) => prev.filter((i) => i.linkId !== linkId));
    } catch (e: any) {
      if (Platform.OS === "web") {
        window.alert(e?.message ?? "No se pudo eliminar el cuidador");
      } else {
        Alert.alert("Error", e?.message ?? "No se pudo eliminar el cuidador");
      }
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, backgroundColor: Colors.background }}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: Colors.text }}>
        Mis cuidadores
      </Text>

      <FlatList
        data={items}
        keyExtractor={(i) => i.linkId}
        ListEmptyComponent={
          <Text style={{ color: Colors.muted, marginTop: 20 }}>
            No tienes cuidadores activos.
          </Text>
        }
        renderItem={({ item }) => (
          <Card>
            <Text style={{ fontWeight: "700", color: Colors.text }}>
              {item.caregiver.fullName}
            </Text>
            <Text style={{ color: Colors.muted }}>
              {item.caregiver.email}
            </Text>

            <PrimaryButton
              title="Eliminar cuidador"
              variant="danger"
              onPress={() => handleRemove(item.linkId)}
            />
          </Card>
        )}
      />
    </SafeAreaView>
  );
}
