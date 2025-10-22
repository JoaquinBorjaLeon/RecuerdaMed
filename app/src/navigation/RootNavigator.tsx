import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Login from "../screens/Login";
import Home from "../screens/Home";

const Stack = createNativeStackNavigator();

export default function RootNavigator({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: true }}>
        {isLoggedIn ? (
          <Stack.Screen name="Home" component={Home} options={{ title: "RecuerdaMed" }} />
        ) : (
          <Stack.Screen name="Login" component={Login} options={{ title: "Iniciar sesión" }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
