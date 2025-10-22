import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      {/* index.tsx será "/", home.tsx será "/home" */}
    </Stack>
  );
}
