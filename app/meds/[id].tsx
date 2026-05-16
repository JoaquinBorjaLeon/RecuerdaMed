import { useEffect, useState } from "react";
import { Text, FlatList, Alert, Platform, StyleSheet, Image, View, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { Href } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";
import { auth, db } from "../../src/lib/firebase";

import type { Medication, Schedule } from "../../src/types";
import { listenSchedulesByMed } from "../../src/api/schedules";
import { deleteMedication, updateMedication } from "../../src/api/meds";
import { canDeleteMedication } from "../../src/api/tomas";
import { uploadMedicationImage } from "../../src/lib/storage";
import { PrimaryButton } from "../../src/components/primaryButton";
import { Card } from "../../src/components/card";
import { Colors } from "../../src/theme/colors";

export default function MedDetail() {
  const { id, readonly, patientId } = useLocalSearchParams<{
    id: string;
    readonly?: string;
    patientId?: string;
  }>();
  const router = useRouter();

  const [med, setMed] = useState<Medication | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [updatingPhoto, setUpdatingPhoto] = useState(false);

  const isReadOnly = readonly === "1" || readonly === "true";
  const effectivePatientId = patientId;

  useEffect(() => {
    if (!id) return;

    (async () => {
      try {
        const snap = await getDoc(doc(db, "medications", String(id)));
        if (snap.exists()) {
          setMed({ id: snap.id, ...(snap.data() as any) });
        }
      } catch (e: any) {
        console.warn("getDoc medication error:", e?.code, e?.message, e);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const schedulePatientId = patientId ?? med?.patientId;
    if (!schedulePatientId) return;

    const unsub = listenSchedulesByMed(String(id), setSchedules, schedulePatientId);
    return () => unsub();
  }, [id, patientId, med?.patientId]);

  function renderSchedule(s: Schedule) {
    if (s.pattern === "DAILY") return `Diaria a ${s.times?.join(", ")}`;
    if (s.pattern === "DOW") {
      const map = ["L", "M", "X", "J", "V", "S", "D"];
      const dias = (s.dow || []).map((n) => map[n - 1]).join(",");
      return `Días ${dias} a ${s.times?.join(", ")}`;
    }
    return `Cada ${s.everyXHours}h desde ${s.startDate}${
      s.endDate ? ` hasta ${s.endDate}` : ""
    }`;
  }

async function handleDelete() {
  if (!med || deleting) return;
  setDeleting(true);

  const targetAfterDelete: Href = patientId
    ? ({
        pathname: "/care/patient/[id]",
        params: { id: String(patientId) },
      } as Href)
    : ("/home" as Href);

  try {
    const ok = await canDeleteMedication(med.id, med.patientId);
    if (!ok) {
      const msg = "No puedes eliminar: hay tomas futuras o planificaciones activas.";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert("No permitido", msg);
      setDeleting(false);
      return;
    }

    await deleteMedication(med.id);
    if (Platform.OS === "web") {
      window.alert("Medicación eliminada");
      router.replace(targetAfterDelete);
    } else {
      Alert.alert("OK", "Medicación eliminada", [
        {
          text: "Aceptar",
          onPress: () => router.replace(targetAfterDelete),
        },
      ]);
    }
  } catch (e: any) {
    const msg = e?.code ?? e?.message ?? "No se pudo eliminar";
    if (Platform.OS === "web") window.alert(msg);
    else Alert.alert("Error", msg);
  } finally {
    setDeleting(false);
  }
}

  async function updatePhotoFromUri(uri: string) {
    const uid = auth.currentUser?.uid;
    if (!uid || !med || updatingPhoto) return;

    setUpdatingPhoto(true);
    try {
      const imageUrl = await uploadMedicationImage(uid, uri);
      await updateMedication(med.id, { imageUrl });
      setMed((prev) => (prev ? { ...prev, imageUrl } : prev));
      Alert.alert("Listo", "Foto de medicación actualizada");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo actualizar la foto");
    } finally {
      setUpdatingPhoto(false);
    }
  }

  async function pickPhotoFromGallery() {
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
      await updatePhotoFromUri(result.assets[0].uri);
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
        await updatePhotoFromUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert("No disponible", "No se pudo abrir la cámara en este dispositivo.");
    }
  }

  async function removePhoto() {
    if (!med || updatingPhoto) return;
    setUpdatingPhoto(true);
    try {
      await updateMedication(med.id, { imageUrl: "" });
      setMed((prev) => (prev ? { ...prev, imageUrl: "" } : prev));
      Alert.alert("Listo", "Foto eliminada");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo eliminar la foto");
    } finally {
      setUpdatingPhoto(false);
    }
  }


  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors.background }]}>
      {med ? (
        <>
          <Card>
            <View style={styles.headerRow}>
              {!!med.imageUrl ? (
                <Image
                  source={{ uri: med.imageUrl }}
                  style={styles.medImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.medImagePlaceholder}>
                  <Text style={styles.medImagePlaceholderText}>Sin foto</Text>
                </View>
              )}
              <View style={styles.headerInfo}>
                <Text style={styles.title}>{med.name}</Text>
                {!!med.strength && <Text style={styles.meta}>{med.strength}</Text>}
                {!!med.form && <Text style={styles.meta}>{med.form}</Text>}
                {!!med.notes && <Text style={styles.notes}>{med.notes}</Text>}
              </View>
            </View>

            {!isReadOnly && (
              <View style={styles.photoActionsWrap}>
                <Text style={styles.photoActionsTitle}>Foto de referencia</Text>
                <View style={styles.photoActionsRow}>
                  <TouchableOpacity
                    onPress={pickPhotoFromGallery}
                    disabled={updatingPhoto}
                    style={[styles.actionChip, updatingPhoto && styles.actionChipDisabled]}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.actionChipText}>
                      {updatingPhoto ? "Actualizando..." : "Galería"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={takePhoto}
                    disabled={updatingPhoto}
                    style={[styles.actionChip, updatingPhoto && styles.actionChipDisabled]}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.actionChipText}>Cámara</Text>
                  </TouchableOpacity>
                </View>
                {!!med.imageUrl && (
                  <TouchableOpacity
                    onPress={removePhoto}
                    disabled={updatingPhoto}
                    style={[styles.removePhotoBtn, updatingPhoto && styles.actionChipDisabled]}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.removePhotoText}>Quitar foto</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </Card>

          <Text style={styles.sectionTitle}>Planificaciones</Text>

          <FlatList
            data={schedules}
            style={styles.scheduleList}
            contentContainerStyle={styles.scheduleListContent}
            scrollEnabled={false}
            keyExtractor={(i) => i.id}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No hay planificaciones aún.</Text>
            }
            renderItem={({ item }) => (
              <Card
                {...(!isReadOnly
                  ? {
                      onPress: () =>
                        router.push({
                          pathname: "/meds/[id]/schedule/[sid]",
                          params: {
                            id: String(id),
                            sid: item.id,
                            ...(isReadOnly ? { readonly: "1" } : {}),
                            ...(effectivePatientId
                              ? { patientId: effectivePatientId }
                              : {}),
                          },
                        }),
                    }
                  : {})}
              >
                <Text style={styles.scheduleTitle}>{renderSchedule(item)}</Text>
                <Text style={styles.scheduleMeta}>
                  Inicio: {item.startDate}
                  {item.endDate ? ` · Fin: ${item.endDate}` : ""}
                </Text>
              </Card>
            )}
          />

          {!isReadOnly && (
            <PrimaryButton
              title="Nueva planificación"
              onPress={() =>
                router.push({
                  pathname: "/meds/[id]/schedule/new",
                  params: {
                    id,
                    ...(effectivePatientId ? { patientId: effectivePatientId } : {}),
                  },
                })
              }
            />
          )}

          {!isReadOnly && (
            <PrimaryButton
              title={deleting ? "Eliminando..." : "Eliminar medicación"}
              variant="danger"
              onPress={handleDelete}
            />
          )}

          <PrimaryButton
            title="Volver"
            onPress={() =>
              router.replace(
                patientId
                  ? (isReadOnly
                      ? ({
                          pathname: "/family/patient/[id]",
                          params: { id: String(patientId) },
                        } as Href)
                      : ({
                          pathname: "/care/patient/[id]",
                          params: { id: String(patientId) },
                        } as Href))
                  : ("/home" as Href)
              )
            }
          />
        </>
      ) : (
        <Text style={styles.loading}>Cargando…</Text>
      )}
    </SafeAreaView>
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
    fontWeight: "800",
    color: Colors.text,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  headerInfo: {
    flex: 1,
  },
  medImage: {
    width: 96,
    height: 96,
    borderRadius: 10,
    backgroundColor: Colors.placeholder,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  medImagePlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  medImagePlaceholderText: {
    color: Colors.muted,
    fontWeight: "600",
    fontSize: 12,
  },
  meta: {
    color: Colors.muted,
    marginTop: 2,
  },
  notes: {
    color: Colors.muted,
    marginTop: 6,
  },
  photoActionsWrap: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  photoActionsTitle: {
    color: Colors.text,
    fontWeight: "700",
    marginBottom: 8,
  },
  photoActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  actionChip: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionChipDisabled: {
    opacity: 0.6,
  },
  actionChipText: {
    color: Colors.text,
    fontWeight: "600",
  },
  removePhotoBtn: {
    marginTop: 8,
    alignSelf: "flex-start",
  },
  removePhotoText: {
    color: Colors.danger,
    fontWeight: "700",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
    marginTop: 4,
  },
  scheduleList: {
    flexGrow: 0,
  },
  scheduleListContent: {
    paddingBottom: 0,
  },
  emptyText: {
    color: Colors.muted,
  },
  scheduleTitle: {
    fontWeight: "700",
    color: Colors.text,
  },
  scheduleMeta: {
    color: Colors.muted,
    marginTop: 4,
  },
  loading: {
    color: Colors.muted,
  },
});
