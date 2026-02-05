import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Platform,
  Image,
  Pressable,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "../src/lib/firebase";
import { uploadUserAvatar } from "../src/lib/storage";
import { getUserById, updateUserProfile, UserProfile } from "../src/api/users";
import { Card } from "../src/components/card";
import { PrimaryButton } from "../src/components/primaryButton";
import { Colors } from "../src/theme/colors";

function getInitials(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const initials = parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
  return initials || "?";
}

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [fullName, setFullName] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.replace("/");
        return;
      }

      const profile = await getUserById(u.uid);
      if (profile) {
        setUser(profile);
        setFullName(profile.fullName ?? "");
        setPhotoURL(profile.photoURL ?? "");
      }
    });

    return unsub;
  }, [router]);

  const avatarUri = useMemo(() => {
    if (localUri) return localUri;
    if (photoURL.trim()) return photoURL.trim();
    return user?.photoURL ?? "";
  }, [localUri, photoURL, user?.photoURL]);

  async function pickImage() {
    if (Platform.OS !== "web") {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permiso requerido", "Activa acceso a la galería.");
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setLocalUri(result.assets[0].uri);
    }
  }

  async function handleSave() {
    if (!user) return;

    const trimmedName = fullName.trim();
    if (!trimmedName) {
      Alert.alert("Falta el nombre", "Introduce tu nombre completo.");
      return;
    }

    setSaving(true);
    try {
      let finalPhotoURL = photoURL.trim();
      if (localUri) {
        finalPhotoURL = await uploadUserAvatar(user.id, localUri);
      }

      await updateUserProfile(user.id, {
        fullName: trimmedName,
        photoURL: finalPhotoURL || undefined,
      });

      setLocalUri(null);
      setPhotoURL(finalPhotoURL);
      setUser((prev) =>
        prev ? { ...prev, fullName: trimmedName, photoURL: finalPhotoURL } : prev
      );
      if (Platform.OS === "web") {
        window.alert("Perfil actualizado");
        router.back();
      } else {
        Alert.alert("Listo", "Perfil actualizado", [
          { text: "OK", onPress: () => router.back() },
        ]);
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo actualizar");
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Editar perfil</Text>
        <Text style={styles.subtitle}>Actualiza tu nombre e imagen</Text>
      </View>

      <Card>
        <View style={styles.avatarRow}>
          <View style={styles.avatarWrap}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarText}>{getInitials(fullName)}</Text>
              </View>
            )}
          </View>
          <Pressable style={styles.avatarAction} onPress={pickImage}>
            <Text style={styles.avatarActionText}>Elegir de galería</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Nombre completo</Text>
        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="Ej. María López"
          style={styles.input}
        />

        <Text style={styles.label}>URL de imagen</Text>
        <TextInput
          value={photoURL}
          onChangeText={setPhotoURL}
          placeholder="https://..."
          autoCapitalize="none"
          style={styles.input}
        />

        <PrimaryButton
          title={saving ? "Guardando..." : "Guardar cambios"}
          onPress={handleSave}
        />
        <PrimaryButton title="Volver" variant="danger" onPress={() => router.replace("/home")} />
      </Card>
    </View>
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
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
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
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 12,
    backgroundColor: Colors.card,
    color: Colors.text,
    marginTop: 6,
  },
});
