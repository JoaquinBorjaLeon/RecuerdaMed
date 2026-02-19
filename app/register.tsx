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
  Image,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import * as ImagePicker from "expo-image-picker";

import { auth } from "../src/lib/firebase";
import { upsertUserProfile } from "../src/api/users";
import { uploadUserAvatar } from "../src/lib/storage";

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
  const [photoURL, setPhotoURL] = useState("");
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function pickImage() {
    if (Platform.OS !== "web") {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permiso requerido", "Activa acceso a la galería.");
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setLocalUri(result.assets[0].uri);
    }
  }

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

      let finalPhotoURL = photoURL.trim();
      if (localUri) {
        finalPhotoURL = await uploadUserAvatar(cred.user.uid, localUri);
      }

      await upsertUserProfile({
        uid: cred.user.uid,
        email: email.trim().toLowerCase(),
        fullName: fullName.trim(),
        role,
        photoURL: finalPhotoURL || undefined,
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
    <SafeAreaView style={[styles.container, { backgroundColor: Colors.background }]}>
      <View style={styles.header}>
        <Image
          source={require("../assets/images/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>Crear cuenta</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card>
        <View style={styles.avatarRow}>
          <View style={styles.avatarWrap}>
            {localUri || photoURL ? (
              <Image
                source={{ uri: localUri || photoURL }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarText}>?</Text>
              </View>
            )}
          </View>
          <Pressable style={styles.avatarAction} onPress={pickImage}>
            <Text style={styles.avatarActionText}>Elegir de galería</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>URL de imagen</Text>
        <TextInput
          value={photoURL}
          onChangeText={setPhotoURL}
          placeholder="https://..."
          autoCapitalize="none"
          style={styles.input}
        />

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
    </SafeAreaView>
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
  header: {
    alignItems: "center",
    marginBottom: 8,
  },
  logo: {
    width: 96,
    height: 96,
    marginBottom: 8,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: "hidden",
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 72,
    height: 72,
  },
  avatarFallback: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.text,
  },
  avatarAction: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Colors.card,
  },
  avatarActionText: {
    color: Colors.text,
    fontWeight: "600",
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
