// app/family/patients.tsx
import { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import type { Href } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "../../src/lib/firebase";
import { getPatientsForCaregiver } from "../../src/api/careLinks";
import type { UserProfile } from "../../src/api/users";

import { Card } from "../../src/components/card";
import { PrimaryButton } from "../../src/components/primaryButton";
import { Colors } from "../../src/theme/colors";

export default function FamilyPatientsScreen() {
  const router = useRouter();
  const [patients, setPatients] = useState<UserProfile[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.replace("/");
        return;
      }

      try {
        const data = await getPatientsForCaregiver(u.uid);
        setPatients(data);
      } catch (e) {
        console.warn("Error cargando familiares:", e);
      }
    });

    return unsub;
  }, [router]);

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <Text style={styles.title}>Mis familiares</Text>

      <FlatList
        data={patients}
        keyExtractor={(p) => p.id}
        ListEmptyComponent={
          <Text style={{ color: Colors.muted, marginTop: 20 }}>
            No tienes familiares asignados.
          </Text>
        }
        renderItem={({ item }) => (
          <Card
            onPress={() =>
              router.push({
                pathname: "/family/patient/[id]",
                params: { id: item.id },
              })
            }
          >
            <Text style={styles.name}>{item.fullName}</Text>
            <Text style={styles.email}>{item.email}</Text>
          </Card>
        )}
      />

      <PrimaryButton title="Volver" onPress={() => router.replace("/home" as Href)} />
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
