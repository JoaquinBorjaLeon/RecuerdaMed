import { useEffect } from "react";
import { Platform } from "react-native";
import { Stack, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === "web") return;

    const handleResponse = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as any;
      const route = data?.route ?? "/tomas";

      if (route === "/tomas") {
        router.push({
          pathname: "/tomas",
          params: data?.tomaId ? { tomaId: String(data.tomaId) } : {},
        });
        return;
      }

      router.push(route);
    };

    const sub = Notifications.addNotificationResponseReceivedListener(handleResponse);

    Notifications.getLastNotificationResponseAsync().then((res) => {
      if (res) handleResponse(res);
    });

    return () => sub.remove();
  }, [router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* index.tsx será "/", home.tsx será "/home" */}
    </Stack>
  );
}
