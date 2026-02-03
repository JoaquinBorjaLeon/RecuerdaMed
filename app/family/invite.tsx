import { useState } from "react";
import { View, Text, TextInput, Alert, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { auth } from "../../src/lib/firebase";
import { inviteCaregiver } from "../../src/api/careLinks";

import { PrimaryButton } from "../../src/components/primaryButton";
import { Colors } from "../../src/theme/colors";

export default function InviteFamilyScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  async function handleInvite() {
    const user = auth.currentUser;
    if (!user) return;

    if (!email.trim()) {
      Alert.alert("Error", "Introduce un email válido");
      return;
    }

    try {
      await inviteCaregiver(user.uid, email.trim());
      Alert.alert(
        "Invitación enviada",
        "El familiar podrá aceptarla desde su cuenta"
      );
      router.replace("/home");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo enviar la invitación");
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <Text style={styles.title}>Invitar familiar</Text>

      <Text style={styles.label}>Email del familiar</Text>
      <TextInput
        placeholder="correo@ejemplo.com"
        placeholderTextColor={Colors.muted}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />

      <PrimaryButton title="Enviar invitación" onPress={handleInvite} />
      <PrimaryButton
        title="Cancelar"
        variant="danger"
        onPress={() => router.replace("/home")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 8,
  },
  label: {
    color: Colors.text,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 12,
    color: Colors.text,
  },
});
