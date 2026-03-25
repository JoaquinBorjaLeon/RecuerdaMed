import * as Notifications from "expo-notifications";

export async function registerForPushNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    throw new Error("Permisos de notificación no concedidos");
  }

  const tokenData = await Notifications.getExpoPushTokenAsync();
  return tokenData.data;
}

export async function sendTestLocalNotification() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "💊 RecuerdaMed",
      body: "Esto es una notificación de prueba (H4.1)",
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 3,
    }, // aparece en 3 segundos
  });
}

export async function cancelTomaNotification(notificationId: string) {
  if (!notificationId) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

export async function sendPushToUsers(
  tokens: string[],
  title: string,
  body: string
) {
  if (!tokens.length) return;

  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      tokens.map((token) => ({
        to: token,
        sound: "default",
        title,
        body,
      }))
    ),
  });
}

// compat
export async function sendPushToCaregivers(
  tokens: string[],
  title: string,
  body: string
) {
  return sendPushToUsers(tokens, title, body);
}


