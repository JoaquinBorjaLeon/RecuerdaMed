import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Alert,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
} from "firebase/auth";

import { auth } from "../src/lib/firebase";
import { getUserById } from "../src/api/users";
import { Card } from "../src/components/card";
import { PrimaryButton } from "../src/components/primaryButton";
import { Colors } from "../src/theme/colors";

/** Pantalla de login. Redirige automáticamente si ya hay sesión activa. */
export default function Login() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Si hay sesión activa, redirigir según tenga o no perfil
  useEffect(() => {
    setEmail("");
    setPass("");

    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return;

      try {
        const profile = await getUserById(u.uid);

        if (!profile) {
          router.replace("/register");
        } else {
          router.replace("/home");
        }
      } catch (e) {
        console.warn("Profile check error", e);
      }
    });

    return unsub;
  }, [router]);

  /** Valida email y contraseña antes de enviar */
  function validate() {
    if (!email.trim() || !pass) {
      Alert.alert("Faltan datos", "Introduce email y contraseña.");
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

  async function handleLogin() {
    if (!validate()) return;

    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email.trim(), pass);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo iniciar sesión");
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
        <Text style={styles.appName}>RecuerdaMed</Text>
        <Text style={styles.subtitle}>Accede a tu cuenta</Text>
      </View>

      <Card>
        <Text style={styles.label}>Email</Text>
        <TextInput
          placeholder="correo@ejemplo.com"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="off"
          textContentType="none"
          importantForAutofill="no"
          autoCorrect={false}
          spellCheck={false}
          value={email}
          onChangeText={setEmail}
          onFocus={() => setEmail("")}
          style={styles.input}
          placeholderTextColor={Colors.muted}
        />

        <Text style={styles.label}>Contraseña</Text>
        <TextInput
          placeholder="Tu contraseña"
          secureTextEntry
          autoComplete="off"
          textContentType="none"
          importantForAutofill="no"
          autoCorrect={false}
          spellCheck={false}
          value={pass}
          onChangeText={setPass}
          onFocus={() => setPass("")}
          style={styles.input}
          placeholderTextColor={Colors.muted}
        />

        {loading ? (
          <ActivityIndicator style={{ marginTop: 12 }} />
        ) : (
          <>
            <PrimaryButton title="Iniciar sesión" onPress={handleLogin} />
            <PrimaryButton
              title="Crear cuenta"
              variant="danger"
              onPress={() => router.push("/register")}
            />
          </>
        )}
      </Card>

      {!loading && (
        <Pressable
          onPress={() => router.push("/register")}
          style={styles.linkWrap}
        >
          <Text style={styles.linkText}>
            ¿No tienes cuenta? Crear cuenta
          </Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    gap: 16,
  },
  header: {
    alignItems: "center",
    marginBottom: 8,
  },
  appName: {
    fontSize: 28,
    fontWeight: "800",
    color: Colors.text,
  },
  logo: {
    width: 96,
    height: 96,
    marginBottom: 8,
  },
  subtitle: {
    marginTop: 6,
    color: Colors.muted,
  },
  label: {
    color: Colors.text,
    fontWeight: "600",
    marginTop: 10,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 12,
    color: Colors.text,
  },
  linkWrap: {
    alignSelf: "center",
    paddingTop: 6,
  },
  linkText: {
    color: Colors.primary,
    fontWeight: "600",
  },
});
