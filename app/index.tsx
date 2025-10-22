// app/index.tsx
import { useEffect, useState } from "react";
import { View, Text, TextInput, Button, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "./src/lib/firebase";
import { ensurePatientProfile } from "./src/api/patients";

export default function Login() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Si hay sesión, asegura perfil y navega a Home
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          await ensurePatientProfile(u.uid);
          router.replace("/home");
        } catch (e: any) {
          console.warn("ensurePatientProfile error:", e?.message);
        }
      }
    });
    return () => unsub();
  }, [router]);

  function validate() {
    if (!email.trim() || !pass) {
      Alert.alert("Faltan datos", "Introduce email y contraseña.");
      return false;
    }
    if (!email.includes("@")) {
      Alert.alert("Email no válido", "Revisa el formato del email.");
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

  async function handleRegister() {
    if (!validate()) return;
    try {
      setLoading(true);
      await createUserWithEmailAndPassword(auth, email.trim(), pass);
      Alert.alert("Cuenta creada", "Sesión iniciada.");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo registrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 24, marginBottom: 8 }}>RecuerdaMed</Text>

      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="username"
        value={email}
        onChangeText={setEmail}
        style={{ borderWidth: 1, padding: 12, borderRadius: 8 }}
      />

      <TextInput
        placeholder="Contraseña"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="password"
        value={pass}
        onChangeText={setPass}
        style={{ borderWidth: 1, padding: 12, borderRadius: 8 }}
      />

      {loading ? (
        <ActivityIndicator />
      ) : (
        <>
          <Button title="Iniciar sesión" onPress={handleLogin} />
          <Button title="Crear cuenta" onPress={handleRegister} />
        </>
      )}
    </View>
  );
}
