// app/index.tsx
import { useEffect, useState } from "react";
import { View, Text, TextInput, Button, Alert } from "react-native";
import { useRouter } from "expo-router";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "./src/lib/firebase"; // ajusta la ruta si tu firebase.ts está en otro sitio

export default function Login() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) router.replace("/home");
    });
    return unsub;
  }, []);

  async function handleLogin() {
    try { await signInWithEmailAndPassword(auth, email.trim(), pass); }
    catch (e: any) { Alert.alert("Error", e?.message ?? "No se pudo iniciar sesión"); }
  }
  async function handleRegister() {
    try { await createUserWithEmailAndPassword(auth, email.trim(), pass); }
    catch (e: any) { Alert.alert("Error", e?.message ?? "No se pudo registrar"); }
  }

  return (
    <View style={{ flex:1, justifyContent:"center", padding:24, gap:12 }}>
      <Text style={{ fontSize:24, marginBottom:8 }}>RecuerdaMed</Text>
      <TextInput placeholder="Email" autoCapitalize="none" keyboardType="email-address"
        value={email} onChangeText={setEmail} style={{ borderWidth:1, padding:12, borderRadius:8 }} />
      <TextInput placeholder="Contraseña" secureTextEntry value={pass}
        onChangeText={setPass} style={{ borderWidth:1, padding:12, borderRadius:8 }} />
      <Button title="Iniciar sesión" onPress={handleLogin} />
      <Button title="Crear cuenta" onPress={handleRegister} />
    </View>
  );
}
