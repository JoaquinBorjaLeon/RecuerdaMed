import { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "../lib/firebase";
import { getPatientsForCaregiver } from "../api/careLinks";
import type { UserProfile } from "../api/users";

import { Card } from "./card";
import { PrimaryButton } from "./primaryButton";
import { Colors } from "../theme/colors";

type Props = {
  title: string;
  subtitle: string;
  emptyText: string;
  patientRoute: "/care/patient/[id]" | "/family/patient/[id]";
};

export default function PatientListScreenBase({
  title,
  subtitle,
  emptyText,
  patientRoute,
}: Props) {
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
        console.warn("Error cargando pacientes:", e);
      }
    });

    return unsub;
  }, [router]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors.background }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <FlatList
        data={patients}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{emptyText}</Text>
        }
        renderItem={({ item }) => (
          <Card
            onPress={() =>
              router.push({
                pathname: patientRoute,
                params: { id: item.id },
              })
            }
          >
            <Text style={styles.name}>{item.fullName}</Text>
            <Text style={styles.email}>{item.email}</Text>
          </Card>
        )}
      />

      <PrimaryButton title="Volver" onPress={() => router.replace("/home")} />
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
  name: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
  },
  email: {
    color: Colors.muted,
    marginTop: 2,
  },
});
