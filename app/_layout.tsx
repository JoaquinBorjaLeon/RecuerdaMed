import { useEffect } from "react";
import { Platform } from "react-native";
import { Stack, useRouter } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

export default function RootLayout() {
  const router = useRouter();

  // Deep linking desde notificaciones push (solo nativo)
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
    <SafeAreaProvider>
      {Platform.OS === "web" && (
        <>
          <Analytics />
          <SpeedInsights />
        </>
      )}
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
