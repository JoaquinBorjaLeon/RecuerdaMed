// app/register.tsx
import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";

import { auth } from "../src/lib/firebase";
import { upsertUserProfile } from "../src/api/users";

import { PrimaryButton } from "../src/components/primaryButton";
import { Card } from "../src/components/card";
import { Colors } from "../src/theme/colors";

type Role = "PATIENT" | "CAREGIVER" | "FAMILY";

export default function RegisterScreen() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [role, setRole] = useState<Role>("PATIENT");
  const [loading, setLoading] = useState(false);

  function validate() {
    if (!fullName.trim()) {
      Alert.alert("Falta el nombre", "Introduce tu nombre completo.");
      return false;
    }
    if (!email.includes("@")) {
      Alert.alert("Email no válido");
      return false;
    }
    if (pass.length < 6) {
      Alert.alert("Contraseña débil", "Mínimo 6 caracteres.");
      return false;
    }
    return true;
  }

  async function handleRegister() {
    if (!validate()) return;

    try {
      setLoading(true);

      const cred = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        pass
      );

      await upsertUserProfile({
        uid: cred.user.uid,
        email: email.trim().toLowerCase(),
        fullName: fullName.trim(),
        role,
      });

      Alert.alert("Cuenta creada", "Registro completado correctamente.");
      router.replace("/home");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo crear la cuenta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <Text style={styles.title}>Crear cuenta</Text>

      <Card>
        <Text style={styles.label}>Nombre completo</Text>
        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="Ej. María López"
          style={styles.input}
        />

        <Text style={styles.label}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="email@ejemplo.com"
          style={styles.input}
        />

        <Text style={styles.label}>Contraseña</Text>
        <TextInput
          value={pass}
          onChangeText={setPass}
          secureTextEntry
          placeholder="Mínimo 6 caracteres"
          style={styles.input}
        />

        <Text style={styles.label}>Tipo de cuenta</Text>

        <PrimaryButton
          title={
            role === "PATIENT"
              ? "Paciente ✓"
              : "Paciente"
          }
          onPress={() => setRole("PATIENT")}
          variant={role === "PATIENT" ? "primary" : "danger"}
        />

        <PrimaryButton
          title={
            role === "CAREGIVER"
              ? "Cuidador ✓"
              : "Cuidador"
          }
          onPress={() => setRole("CAREGIVER")}
          variant={role === "CAREGIVER" ? "primary" : "danger"}
        />

        <PrimaryButton
          title={
            role === "FAMILY"
              ? "Familiar ✓"
              : "Familiar"
          }
          onPress={() => setRole("FAMILY")}
          variant={role === "FAMILY" ? "primary" : "danger"}
        />

        {loading ? (
          <ActivityIndicator style={{ marginTop: 12 }} />
        ) : (
          <PrimaryButton
            title="Crear cuenta"
            onPress={handleRegister}
          />
        )}

        <PrimaryButton
          title="Volver"
          variant="danger"
          onPress={() => router.back()}
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 16,
  },
  label: {
    fontWeight: "600",
    color: Colors.text,
    marginTop: 10,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.muted,
    borderRadius: 10,
    padding: 12,
    color: Colors.text,
  },
});
