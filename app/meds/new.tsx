import { useState, useEffect } from "react";
import { View, Text, TextInput, Alert, StyleSheet, Image, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import * as ImagePicker from "expo-image-picker";

import { auth } from "../../src/lib/firebase";
import { createMedication } from "../../src/api/meds";
import { uploadMedicationImage } from "../../src/lib/storage";
import { Colors } from "../../src/theme/colors";
import { PrimaryButton } from "../../src/components/primaryButton";

/** Formulario para crear una nueva medicación (paciente o cuidador) */
export default function NewMedication() {
  const router = useRouter();
  const params = useLocalSearchParams<{ patientId?: string }>();

  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [form, setForm] = useState("");
  const [strength, setStrength] = useState("");
  const [notes, setNotes] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.replace("/");
        return;
      }
      setUserId(u.uid);
    });
  }, [router]);

  async function pickFromGallery() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") {
      Alert.alert("Permiso requerido", "Necesitamos acceso a tu galería para elegir la foto.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      setImageUri(result.assets[0].uri);
    }
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== "granted") {
      Alert.alert("Permiso requerido", "Necesitamos acceso a la cámara para tomar la foto.");
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        setImageUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert("No disponible", "No se pudo abrir la cámara en este dispositivo.");
    }
  }

  /** Valida, sube imagen si hay, crea la medicación y redirige */
  async function save() {
    try {
      if (saving) return;
      setSaving(true);
      if (!userId) throw new Error("Usuario no autenticado");
      if (!name.trim()) throw new Error("El nombre es obligatorio");

      // Si no viene patientId, el paciente es el propio usuario
      const realPatientId = params.patientId ?? userId;
      let imageUrl: string | undefined;

      if (imageUri) {
        try {
          imageUrl = await uploadMedicationImage(userId, imageUri);
        } catch {
          Alert.alert(
            "Aviso",
            "No se pudo subir la foto. Se guardará la medicación sin imagen."
          );
        }
      }

      await createMedication(realPatientId, {
        name: name.trim(),
        form,
        strength,
        notes,
        imageUrl,
      });

      Alert.alert("OK", "Medicación creada");

      if (params.patientId) {
        router.replace({
          pathname: "/care/patient/[id]",
          params: { id: params.patientId },
        });
      } else {
        router.replace("/home");
      }
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Nueva medicación</Text>

        <Text style={styles.label}>Nombre *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Paracetamol"
          placeholderTextColor={Colors.muted}
        />

        <Text style={styles.label}>Forma</Text>
        <TextInput
          style={styles.input}
          value={form}
          onChangeText={setForm}
          placeholder="Comprimido, jarabe…"
          placeholderTextColor={Colors.muted}
        />

        <Text style={styles.label}>Dosis</Text>
        <TextInput
          style={styles.input}
          value={strength}
          onChangeText={setStrength}
          placeholder="500 mg"
          placeholderTextColor={Colors.muted}
        />

        <Text style={styles.label}>Notas</Text>
        <TextInput
          style={[styles.input, { minHeight: 90 }]}
          multiline
          value={notes}
          onChangeText={setNotes}
          placeholder="Tomar con comida"
          placeholderTextColor={Colors.muted}
        />

        <Text style={styles.label}>Foto de referencia (opcional)</Text>
        {imageUri ? (
          <View style={styles.previewWrap}>
            <Image source={{ uri: imageUri }} style={styles.previewImage} />
          </View>
        ) : (
          <Text style={styles.helperText}>
            Añade una foto de la caja o pastilla para evitar confusiones.
          </Text>
        )}

        <PrimaryButton title="Subir desde galería" onPress={pickFromGallery} />
        <PrimaryButton title="Tomar foto" onPress={takePhoto} />
        {imageUri && (
          <PrimaryButton
            title="Quitar foto"
            variant="danger"
            onPress={() => setImageUri(null)}
          />
        )}

        <PrimaryButton title={saving ? "Guardando..." : "Guardar"} onPress={save} disabled={saving} />
        <PrimaryButton
          title="Cancelar"
          variant="danger"
          onPress={() =>
            params.patientId
              ? router.replace({
                  pathname: "/care/patient/[id]",
                  params: { id: params.patientId },
                })
              : router.replace("/home")
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  scrollContent: {
    paddingBottom: 24,
  },
  title: { fontSize: 22, fontWeight: "700", color: Colors.text, marginBottom: 12 },
  label: { color: Colors.text, fontWeight: "600", marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 12,
    color: Colors.text,
    marginTop: 4,
  },
  helperText: {
    color: Colors.muted,
    marginTop: 4,
  },
  previewWrap: {
    marginTop: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    overflow: "hidden",
  },
  previewImage: {
    width: 160,
    height: 160,
    alignSelf: "center",
    backgroundColor: "#E5E7EB",
    borderRadius: 10,
  },
});
