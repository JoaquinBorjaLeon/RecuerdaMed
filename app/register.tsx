// app/register.tsx
import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ScrollView,
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

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card>
        <Text style={styles.label}>Nombre completo</Text>
        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="Ej. María López"
          autoComplete="off"
          textContentType="none"
          importantForAutofill="no"
          style={styles.input}
        />

        <Text style={styles.label}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          onFocus={() => setEmail("")}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="email@ejemplo.com"
          autoComplete="off"
          textContentType="none"
          importantForAutofill="no"
          autoCorrect={false}
          spellCheck={false}
          style={styles.input}
        />

        <Text style={styles.label}>Contraseña</Text>
        <TextInput
          value={pass}
          onChangeText={setPass}
          onFocus={() => setPass("")}
          secureTextEntry
          placeholder="Mínimo 6 caracteres"
          autoComplete="new-password"
          textContentType="none"
          importantForAutofill="no"
          autoCorrect={false}
          spellCheck={false}
          style={styles.input}
        />

        <Text style={styles.label}>Tipo de cuenta</Text>
        <Text style={styles.help}>Elige el perfil que usarás</Text>

        <View style={styles.roleGrid}>
          <Pressable
            onPress={() => setRole("PATIENT")}
            style={[
              styles.roleCard,
              role === "PATIENT" && styles.roleCardSelected,
            ]}
          >
            <Text
              style={[
                styles.roleTitle,
                role === "PATIENT" && styles.roleTitleSelected,
              ]}
            >
              Paciente
            </Text>
            <Text
              style={[
                styles.roleDesc,
                role === "PATIENT" && styles.roleDescSelected,
              ]}
            >
              Gestiona tu medicación
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setRole("CAREGIVER")}
            style={[
              styles.roleCard,
              role === "CAREGIVER" && styles.roleCardSelected,
            ]}
          >
            <Text
              style={[
                styles.roleTitle,
                role === "CAREGIVER" && styles.roleTitleSelected,
              ]}
            >
              Cuidador
            </Text>
            <Text
              style={[
                styles.roleDesc,
                role === "CAREGIVER" && styles.roleDescSelected,
              ]}
            >
              Ayuda a pacientes
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setRole("FAMILY")}
            style={[
              styles.roleCard,
              role === "FAMILY" && styles.roleCardSelected,
            ]}
          >
            <Text
              style={[
                styles.roleTitle,
                role === "FAMILY" && styles.roleTitleSelected,
              ]}
            >
              Familiar
            </Text>
            <Text
              style={[
                styles.roleDesc,
                role === "FAMILY" && styles.roleDescSelected,
              ]}
            >
              Solo lectura y avisos
            </Text>
          </Pressable>
        </View>

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
            onPress={() => router.replace("/")}
          />
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  scrollContent: {
    paddingBottom: 24,
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
  help: {
    color: Colors.muted,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.muted,
    borderRadius: 10,
    padding: 12,
    color: Colors.text,
  },
  roleGrid: {
    gap: 10,
  },
  roleCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    padding: 14,
    borderRadius: 12,
  },
  roleCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: "#DBEAFE",
  },
  roleTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
  },
  roleTitleSelected: {
    color: Colors.primary,
  },
  roleDesc: {
    color: Colors.muted,
    marginTop: 4,
  },
  roleDescSelected: {
    color: Colors.primary,
  },
});
