// app/index.tsx
import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
} from "firebase/auth";

import { auth } from "../src/lib/firebase";
import { getUserById } from "../src/api/users";

export default function Login() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Si hay sesión, comprobar si tiene perfil
  useEffect(() => {
    setEmail("");
    setPass("");

    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return;

      try {
        const profile = await getUserById(u.uid);

        if (!profile) {
          // Usuario sin perfil → completar registro
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
    <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 26, fontWeight: "700", marginBottom: 12 }}>
        RecuerdaMed
      </Text>

      <TextInput
        placeholder="Email"
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
        style={{ borderWidth: 1, padding: 12, borderRadius: 10 }}
      />

      <TextInput
        placeholder="Contraseña"
        secureTextEntry
        autoComplete="off"
        textContentType="none"
        importantForAutofill="no"
        autoCorrect={false}
        spellCheck={false}
        value={pass}
        onChangeText={setPass}
        onFocus={() => setPass("")}
        style={{ borderWidth: 1, padding: 12, borderRadius: 10 }}
      />

      {loading ? (
        <ActivityIndicator />
      ) : (
        <>
          <Button title="Iniciar sesión" onPress={handleLogin} />
          <Button
            title="Crear cuenta"
            onPress={() => router.push("/register")}
          />
        </>
      )}
    </View>
  );
}
