import { getActiveCaregivers } from "./careLinks";
import { getPushTokensByUserIds } from "./pushTokens";

export async function getCaregiverPushTokens(patientId: string): Promise<string[]> {
  const caregiverIds = await getActiveCaregivers(patientId);
  if (!caregiverIds.length) return [];
  return getPushTokensByUserIds(caregiverIds);
}
