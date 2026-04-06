import { getActiveCaregivers } from "./careLinks";
import { getPushTokensByUserIds } from "./pushTokens";

/** Obtiene los push tokens de los cuidadores activos de un paciente */
export async function getCaregiverPushTokens(patientId: string): Promise<string[]> {
  const caregiverIds = await getActiveCaregivers(patientId);
  if (!caregiverIds.length) return [];
  return getPushTokensByUserIds(caregiverIds);
}
